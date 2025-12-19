import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FUNCTION_NAME = 'analise-sentimento-ia';

const sentimentosLabels: Record<string, string> = {
  feliz: 'Feliz',
  cuidadoso: 'Cuidadoso',
  abencoado: 'Abençoado',
  grato: 'Grato',
  angustiado: 'Angustiado',
  sozinho: 'Sozinho',
  triste: 'Triste',
  doente: 'Doente',
  com_pouca_fe: 'Com pouca fé',
  com_medo: 'Com medo'
};

const negativeSentiments = ['angustiado', 'sozinho', 'triste', 'doente', 'com_pouca_fe', 'com_medo'];

// Default prompt if not configured in database
const DEFAULT_SYSTEM_PROMPT = `Você é um assistente pastoral sábio e empático de uma igreja cristã. Analise o relato do membro com cuidado e compaixão.

INSTRUÇÕES:
1. Gere um título curto de 3 a 5 palavras que resuma a situação
2. Identifique a raiz do problema em uma dessas categorias: Saúde, Família, Espiritual, Financeiro, Trabalho, Relacionamento, Luto, Ansiedade, Outro
3. Classifique a gravidade:
   - "baixa": situação rotineira, emoção passageira
   - "media": requer atenção pastoral, acompanhamento recomendado  
   - "critica": sinais de desespero, luto recente, risco emocional, precisa de contato urgente
4. Gere uma mensagem de acolhimento de NO MÁXIMO 3 frases. Seja empático, mencione que a igreja está orando, mas NÃO dê conselhos médicos, psicológicos ou promessas específicas.

IMPORTANTE: Responda SOMENTE com um JSON válido no formato:
{
  "titulo": "string",
  "motivo": "string", 
  "gravidade": "baixa" | "media" | "critica",
  "resposta": "string"
}`;

const DEFAULT_MODEL = 'google/gemini-2.5-flash';

// Fetch chatbot config from database
async function getChatbotConfig(supabase: any): Promise<{ model: string; systemPrompt: string }> {
  try {
    const { data: config, error } = await supabase
      .from('chatbot_configs')
      .select('modelo_texto, role_texto')
      .eq('edge_function_name', FUNCTION_NAME)
      .eq('ativo', true)
      .single();

    if (error || !config) {
      console.log(`No config found for ${FUNCTION_NAME}, using defaults`);
      return { model: DEFAULT_MODEL, systemPrompt: DEFAULT_SYSTEM_PROMPT };
    }

    return {
      model: config.modelo_texto || DEFAULT_MODEL,
      systemPrompt: config.role_texto || DEFAULT_SYSTEM_PROMPT
    };
  } catch (err) {
    console.error('Error fetching chatbot config:', err);
    return { model: DEFAULT_MODEL, systemPrompt: DEFAULT_SYSTEM_PROMPT };
  }
}

// Helper to find the team leader phone for a member
async function findLeaderPhone(supabase: any, pessoaId: string): Promise<string | null> {
  try {
    const { data: memberships, error } = await supabase
      .from('membros_time')
      .select(`
        time_id,
        times_culto!inner (
          id,
          nome,
          lider_id,
          lider:lider_id (
            telefone
          )
        )
      `)
      .eq('pessoa_id', pessoaId)
      .eq('ativo', true);

    if (error) {
      console.error('Error fetching team memberships:', error);
      return null;
    }

    if (!memberships || memberships.length === 0) {
      console.log('No active team memberships found for member');
      return null;
    }

    for (const membership of memberships) {
      const leaderPhone = membership.times_culto?.lider?.telefone;
      if (leaderPhone) {
        console.log(`Found leader phone from team "${membership.times_culto.nome}": ${leaderPhone}`);
        return leaderPhone;
      }
    }

    console.log('No leader with phone found in member teams');
    return null;
  } catch (err) {
    console.error('Error in findLeaderPhone:', err);
    return null;
  }
}

// Helper to send webhook to Make
async function sendMakeWebhook(webhookUrl: string, payload: any): Promise<boolean> {
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('Make webhook failed:', response.status, await response.text());
      return false;
    }
    
    console.log('Make webhook sent successfully');
    return true;
  } catch (err) {
    console.error('Make webhook error:', err);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sentimento_id } = await req.json();

    if (!sentimento_id) {
      console.error('Missing sentimento_id');
      return new Response(JSON.stringify({ error: 'sentimento_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing sentiment analysis for ID: ${sentimento_id}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch chatbot configuration from database
    const { model, systemPrompt } = await getChatbotConfig(supabase);
    console.log(`Using model: ${model}`);

    const { data: sentimento, error: fetchError } = await supabase
      .from('sentimentos_membros')
      .select(`
        *,
        profiles:pessoa_id (
          id,
          nome,
          telefone,
          user_id
        )
      `)
      .eq('id', sentimento_id)
      .single();

    if (fetchError || !sentimento) {
      console.error('Error fetching sentiment:', fetchError);
      return new Response(JSON.stringify({ error: 'Sentiment not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!sentimento.mensagem) {
      console.log('No message to analyze, skipping AI analysis');
      return new Response(JSON.stringify({ message: 'No content to analyze' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sentimentoLabel = sentimentosLabels[sentimento.sentimento] || sentimento.sentimento;
    const memberName = sentimento.profiles?.nome || 'Membro';
    const memberPhone = sentimento.profiles?.telefone || '';
    const pessoaId = sentimento.profiles?.id;

    console.log(`Analyzing sentiment from ${memberName}: ${sentimentoLabel}`);

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = `Sentimento registrado: ${sentimentoLabel}

Mensagem do membro:
"${sentimento.mensagem}"`;

    let analysis;
    
    try {
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', aiResponse.status, errorText);
        
        analysis = {
          titulo: 'Relato recebido',
          motivo: 'Não identificado',
          gravidade: negativeSentiments.includes(sentimento.sentimento) ? 'media' : 'baixa',
          resposta: 'Recebemos seu relato e estamos orando por você. A igreja está aqui para apoiá-lo.'
        };
      } else {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          console.error('No content in AI response');
          analysis = {
            titulo: 'Relato recebido',
            motivo: 'Não identificado',
            gravidade: negativeSentiments.includes(sentimento.sentimento) ? 'media' : 'baixa',
            resposta: 'Recebemos seu relato e estamos orando por você. A igreja está aqui para apoiá-lo.'
          };
        } else {
          console.log('AI Response:', content);

          try {
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            analysis = JSON.parse(cleanContent);
          } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            analysis = {
              titulo: 'Relato recebido',
              motivo: 'Não identificado',
              gravidade: negativeSentiments.includes(sentimento.sentimento) ? 'media' : 'baixa',
              resposta: 'Recebemos seu relato e estamos orando por você. A igreja está aqui para apoiá-lo.'
            };
          }
        }
      }
    } catch (aiError) {
      console.error('AI request failed (non-blocking):', aiError);
      analysis = {
        titulo: 'Relato recebido',
        motivo: 'Não identificado',
        gravidade: negativeSentiments.includes(sentimento.sentimento) ? 'media' : 'baixa',
        resposta: 'Recebemos seu relato e estamos orando por você. A igreja está aqui para apoiá-lo.'
      };
    }

    const { error: updateError } = await supabase
      .from('sentimentos_membros')
      .update({
        analise_ia_titulo: analysis.titulo,
        analise_ia_motivo: analysis.motivo,
        analise_ia_gravidade: analysis.gravidade,
        analise_ia_resposta: analysis.resposta,
        updated_at: new Date().toISOString()
      })
      .eq('id', sentimento_id);

    if (updateError) {
      console.error('Error updating sentiment:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save analysis' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Analysis saved successfully');

    const isCritical = analysis.gravidade === 'critica' || 
      ['triste', 'com_medo', 'angustiado', 'sozinho'].includes(sentimento.sentimento);

    if (isCritical) {
      console.log('Critical sentiment detected, triggering alert');

      const { data: churchConfig } = await supabase
        .from('configuracoes_igreja')
        .select('telefone_plantao_pastoral, webhook_make_liturgia')
        .single();

      const telefonePlantao = churchConfig?.telefone_plantao_pastoral || Deno.env.get('TELEFONE_PLANTAO') || '';
      const makeWebhookUrl = Deno.env.get('MAKE_WEBHOOK_URL') || churchConfig?.webhook_make_liturgia || '';
      
      const appUrl = Deno.env.get('APP_URL') || SUPABASE_URL.replace('.supabase.co', '.lovable.app');
      const linkAdmin = `${appUrl}/intercessao/sentimentos`;

      let leaderPhone: string | null = null;
      if (pessoaId) {
        leaderPhone = await findLeaderPhone(supabase, pessoaId);
      }

      const primaryPhone = leaderPhone || telefonePlantao;

      console.log(`Primary phone (leader or plantão): ${primaryPhone}`);
      console.log(`Plantão phone (always receives copy): ${telefonePlantao}`);

      const alertMessage = `🚨 ALERTA [${analysis.gravidade.toUpperCase()}]: ${analysis.titulo}. Motivo: ${analysis.motivo}. Membro: ${memberName}.`;
      
      const { error: notifyError } = await supabase.rpc('notify_admins', {
        p_title: `⚠️ Alerta Pastoral: ${analysis.titulo}`,
        p_message: alertMessage,
        p_type: 'alerta_sentimento_critico',
        p_related_user_id: sentimento.profiles?.user_id || null,
        p_metadata: {
          sentimento_id,
          membro_nome: memberName,
          gravidade: analysis.gravidade,
          motivo: analysis.motivo,
          sentimento: sentimentoLabel
        }
      });

      if (notifyError) {
        console.error('Error sending admin notification:', notifyError);
      } else {
        console.log('Admin notification sent');
      }

      if (makeWebhookUrl) {
        const makePayload = {
          membro_nome: memberName,
          membro_telefone: memberPhone,
          sentimento: sentimentoLabel,
          gravidade: analysis.gravidade,
          ai_resumo: `${analysis.titulo} - ${analysis.motivo}`,
          ai_mensagem_membro: analysis.resposta,
          pastor_telefone: primaryPhone,
          link_admin: linkAdmin
        };

        if (primaryPhone) {
          console.log('Sending to primary phone via Make:', primaryPhone);
          await sendMakeWebhook(makeWebhookUrl, {
            ...makePayload,
            pastor_telefone: primaryPhone
          });
        }

        if (telefonePlantao && telefonePlantao !== primaryPhone) {
          console.log('Sending copy to plantão pastoral via Make:', telefonePlantao);
          await sendMakeWebhook(makeWebhookUrl, {
            ...makePayload,
            pastor_telefone: telefonePlantao,
            is_copy: true
          });
        }
      } else {
        console.log('No Make webhook URL configured, skipping WhatsApp alerts');
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      analysis,
      is_critical: isCritical
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
