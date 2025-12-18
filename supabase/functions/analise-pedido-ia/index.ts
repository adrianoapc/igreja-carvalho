import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pedido_id } = await req.json();

    if (!pedido_id) {
      console.error('Missing pedido_id');
      return new Response(JSON.stringify({ error: 'pedido_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing prayer request analysis for ID: ${pedido_id}`);

    // Create Supabase client with service role for full access
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the prayer request with profile info
    const { data: pedido, error: fetchError } = await supabase
      .from('pedidos_oracao')
      .select(`
        *,
        profiles:pessoa_id (
          id,
          nome,
          telefone,
          user_id
        )
      `)
      .eq('id', pedido_id)
      .single();

    if (fetchError || !pedido) {
      console.error('Error fetching prayer request:', fetchError);
      return new Response(JSON.stringify({ error: 'Prayer request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If no content, skip AI analysis
    if (!pedido.pedido) {
      console.log('No content to analyze, skipping AI analysis');
      return new Response(JSON.stringify({ message: 'No content to analyze' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tipoLabel = pedido.tipo || 'Não especificado';
    const memberName = pedido.profiles?.nome || pedido.nome_solicitante || 'Solicitante';

    console.log(`Analyzing prayer request from ${memberName}: ${tipoLabel}`);

    // Call Lovable AI for analysis
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const systemPrompt = `Você é um assistente pastoral sábio e empático de uma igreja cristã. Analise o pedido de oração com cuidado e compaixão.

INSTRUÇÕES:
1. Gere um título curto de 3 a 5 palavras que resuma o pedido
2. Identifique a raiz/categoria principal em uma dessas opções: Saúde, Família, Espiritual, Financeiro, Trabalho, Relacionamento, Luto, Ansiedade, Agradecimento, Outro
3. Classifique a gravidade:
   - "baixa": pedido rotineiro, gratidão, bênçãos gerais
   - "media": situação que requer atenção pastoral, acompanhamento recomendado  
   - "critica": sinais de desespero, luto recente, doença grave, risco emocional
4. Gere uma mensagem de acolhimento de NO MÁXIMO 3 frases. Seja empático, mencione que a equipe de intercessão está orando, mas NÃO dê conselhos médicos, psicológicos ou promessas específicas.

IMPORTANTE: Responda SOMENTE com um JSON válido no formato:
{
  "titulo": "string",
  "motivo": "string", 
  "gravidade": "baixa" | "media" | "critica",
  "resposta": "string"
}`;

    const userPrompt = `Tipo do pedido: ${tipoLabel}

Pedido de oração:
"${pedido.pedido}"`;

    let analysis;
    
    try {
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
        
        // Use fallback analysis
        analysis = {
          titulo: 'Pedido recebido',
          motivo: tipoLabel,
          gravidade: 'baixa',
          resposta: 'Recebemos seu pedido de oração e nossa equipe de intercessores está orando por você.'
        };
      } else {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          console.error('No content in AI response');
          analysis = {
            titulo: 'Pedido recebido',
            motivo: tipoLabel,
            gravidade: 'baixa',
            resposta: 'Recebemos seu pedido de oração e nossa equipe de intercessores está orando por você.'
          };
        } else {
          console.log('AI Response:', content);

          // Parse AI response
          try {
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            analysis = JSON.parse(cleanContent);
          } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            analysis = {
              titulo: 'Pedido recebido',
              motivo: tipoLabel,
              gravidade: 'baixa',
              resposta: 'Recebemos seu pedido de oração e nossa equipe de intercessores está orando por você.'
            };
          }
        }
      }
    } catch (aiError) {
      console.error('AI request failed (non-blocking):', aiError);
      analysis = {
        titulo: 'Pedido recebido',
        motivo: tipoLabel,
        gravidade: 'baixa',
        resposta: 'Recebemos seu pedido de oração e nossa equipe de intercessores está orando por você.'
      };
    }

    // Update the prayer request with AI analysis
    const { error: updateError } = await supabase
      .from('pedidos_oracao')
      .update({
        analise_ia_titulo: analysis.titulo,
        analise_ia_motivo: analysis.motivo,
        analise_ia_gravidade: analysis.gravidade,
        analise_ia_resposta: analysis.resposta,
        // Also update tipo if AI identified a better category
        tipo: analysis.motivo?.toLowerCase().replace(/[^a-z]/g, '') || pedido.tipo
      })
      .eq('id', pedido_id);

    if (updateError) {
      console.error('Error updating prayer request:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save analysis' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Analysis saved successfully');

    return new Response(JSON.stringify({ 
      success: true, 
      analysis
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
