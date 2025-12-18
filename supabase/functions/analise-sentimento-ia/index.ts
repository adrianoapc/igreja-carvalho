import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

serve(async (req) => {
  // Handle CORS preflight
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

    // Create Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the sentiment record with profile info
    const { data: sentimento, error: fetchError } = await supabase
      .from('sentimentos_membros')
      .select(`
        *,
        profiles:pessoa_id (
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

    // If no message, skip AI analysis
    if (!sentimento.mensagem) {
      console.log('No message to analyze, skipping AI analysis');
      return new Response(JSON.stringify({ message: 'No content to analyze' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const sentimentoLabel = sentimentosLabels[sentimento.sentimento] || sentimento.sentimento;
    const memberName = sentimento.profiles?.nome || 'Membro';

    console.log(`Analyzing sentiment from ${memberName}: ${sentimentoLabel}`);

    // Call Lovable AI for analysis
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um assistente pastoral sábio e empático de uma igreja cristã. Analise o relato do membro com cuidado e compaixão.

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

    const userPrompt = `Sentimento registrado: ${sentimentoLabel}

Mensagem do membro:
"${sentimento.mensagem}"`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'Payment required' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      return new Response(JSON.stringify({ error: 'AI analysis failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('No content in AI response');
      return new Response(JSON.stringify({ error: 'Empty AI response' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('AI Response:', content);

    // Parse AI response
    let analysis;
    try {
      // Clean potential markdown code blocks
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      analysis = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback analysis
      analysis = {
        titulo: 'Relato recebido',
        motivo: 'Não identificado',
        gravidade: negativeSentiments.includes(sentimento.sentimento) ? 'media' : 'baixa',
        resposta: 'Recebemos seu relato e estamos orando por você. A igreja está aqui para apoiá-lo.'
      };
    }

    // Update the sentiment record with AI analysis
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

    // Check if critical alert should be triggered
    const isCritical = analysis.gravidade === 'critica' || 
      ['triste', 'com_medo', 'angustiado', 'sozinho'].includes(sentimento.sentimento);

    if (isCritical) {
      console.log('Critical sentiment detected, triggering alert');

      // Fetch church configuration for notification settings
      const { data: churchConfig } = await supabase
        .from('configuracoes_igreja')
        .select('whatsapp_provider, whatsapp_token, whatsapp_instance_id, telefone_plantao_pastoral, webhook_make_liturgia')
        .single();

      const telefonePlantao = churchConfig?.telefone_plantao_pastoral;
      const whatsappProvider = churchConfig?.whatsapp_provider || 'make_webhook';

      // Create notification for admins/pastors
      const alertMessage = `🚨 ALERTA [${analysis.gravidade.toUpperCase()}]: ${analysis.titulo}. Motivo: ${analysis.motivo}. Membro: ${memberName}.`;
      
      // Notify admins via internal notification system
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

      // Prepare WhatsApp payload
      const whatsappPayload = {
        tipo: 'alerta_pastoral',
        membro_nome: memberName,
        membro_telefone: sentimento.profiles?.telefone,
        titulo: analysis.titulo,
        gravidade: analysis.gravidade,
        motivo: analysis.motivo,
        mensagem_acolhimento: analysis.resposta,
        sentimento_original: sentimentoLabel,
        telefone_destino: telefonePlantao
      };

      // Send WhatsApp alert based on provider
      try {
        if (whatsappProvider === 'make_webhook') {
          // Use Make.com webhook
          const makeWebhook = Deno.env.get('MAKE_WEBHOOK_SECRET') || churchConfig?.webhook_make_liturgia;
          if (makeWebhook) {
            await fetch(makeWebhook, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(whatsappPayload)
            });
            console.log('Make webhook triggered');
          }
        } else if (whatsappProvider === 'meta_official' && churchConfig?.whatsapp_token && churchConfig?.whatsapp_instance_id) {
          // Use Meta Official API
          const phoneNumberId = churchConfig.whatsapp_instance_id;
          const accessToken = churchConfig.whatsapp_token;
          
          if (telefonePlantao) {
            await fetch(`https://graph.facebook.com/v18.0/${phoneNumberId}/messages`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: telefonePlantao.replace(/\D/g, ''),
                type: 'text',
                text: { body: alertMessage }
              })
            });
            console.log('Meta API WhatsApp sent');
          }
        } else if (whatsappProvider === 'evolution_api' && churchConfig?.whatsapp_token && churchConfig?.whatsapp_instance_id) {
          // Use Evolution API
          const instanceName = churchConfig.whatsapp_instance_id;
          const apiKey = churchConfig.whatsapp_token;
          
          if (telefonePlantao) {
            await fetch(`https://api.evolution.com.br/message/sendText/${instanceName}`, {
              method: 'POST',
              headers: {
                'apikey': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                number: telefonePlantao.replace(/\D/g, ''),
                text: alertMessage
              })
            });
            console.log('Evolution API WhatsApp sent');
          }
        }
      } catch (webhookError) {
        console.error('WhatsApp send error (non-blocking):', webhookError);
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
