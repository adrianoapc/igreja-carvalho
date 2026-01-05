import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ============= CORS & CONSTANTS =============
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const FUNCTION_NAME = 'analise-pedido-ia';

// ============= FALLBACK DEFAULTS =============
const DEFAULT_MODEL = 'google/gemini-2.5-flash';

const DEFAULT_PROMPT = `Analise este pedido de oração. Identifique a categoria e se há GRAVIDADE ALTA (risco de vida, abuso, crise grave). Retorne JSON.

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

// ============= TYPES =============
interface ChatbotConfig {
  textModel: string;
  systemPrompt: string;
}

interface AnaliseResult {
  titulo: string;
  motivo: string;
  gravidade: string;
  resposta: string;
}

// ============= HELPER FUNCTIONS =============

// Fetch chatbot config from database with fallback
async function getChatbotConfig(supabase: SupabaseClient, igrejaId: string): Promise<ChatbotConfig> {
  try {
    const { data: config, error } = await supabase
      .from('chatbot_configs')
      .select('modelo_texto, role_texto')
      .eq('edge_function_name', FUNCTION_NAME)
      .eq('igreja_id', igrejaId)
      .eq('ativo', true)
      .single();

    if (error || !config) {
      console.log(`[${FUNCTION_NAME}] No config found in database, using defaults`);
      return { textModel: DEFAULT_MODEL, systemPrompt: DEFAULT_PROMPT };
    }

    console.log(`[${FUNCTION_NAME}] Config loaded from database`);
    return {
      textModel: config.modelo_texto || DEFAULT_MODEL,
      systemPrompt: config.role_texto || DEFAULT_PROMPT
    };
  } catch (err) {
    console.error(`[${FUNCTION_NAME}] Error fetching chatbot config:`, err);
    return { textModel: DEFAULT_MODEL, systemPrompt: DEFAULT_PROMPT };
  }
}

// Default analysis when AI fails
function getDefaultAnalysis(tipoLabel: string): AnaliseResult {
  return {
    titulo: 'Pedido recebido',
    motivo: tipoLabel,
    gravidade: 'baixa',
    resposta: 'Recebemos seu pedido de oração e nossa equipe de intercessores está orando por você.'
  };
}

// ============= MAIN HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pedido_id, igreja_id: igrejaId } = await req.json();

    if (!pedido_id) {
      console.error('Missing pedido_id');
      return new Response(JSON.stringify({ error: 'pedido_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    if (!igrejaId) {
      return new Response(JSON.stringify({ error: 'igreja_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${FUNCTION_NAME}] Processing prayer request analysis for ID: ${pedido_id}`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch chatbot configuration from database
    const config = await getChatbotConfig(supabase, igrejaId);
    console.log(`[${FUNCTION_NAME}] Using model: ${config.textModel}`);

    // Fetch prayer request
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
      .eq('igreja_id', igrejaId)
      .single();

    if (fetchError || !pedido) {
      console.error('Error fetching prayer request:', fetchError);
      return new Response(JSON.stringify({ error: 'Prayer request not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!pedido.pedido) {
      console.log('No content to analyze, skipping AI analysis');
      return new Response(JSON.stringify({ message: 'No content to analyze' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tipoLabel = pedido.tipo || 'Não especificado';
    const memberName = pedido.profiles?.nome || pedido.nome_solicitante || 'Solicitante';

    console.log(`[${FUNCTION_NAME}] Analyzing prayer request from ${memberName}: ${tipoLabel}`);

    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(JSON.stringify({ error: 'AI API key not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userPrompt = `Tipo do pedido: ${tipoLabel}

Pedido de oração:
"${pedido.pedido}"`;

    let analysis: AnaliseResult;
    
    try {
      console.log(`[${FUNCTION_NAME}] Calling AI with model: ${config.textModel}`);
      
      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.textModel,
          messages: [
            { role: 'system', content: config.systemPrompt },
            { role: 'user', content: userPrompt }
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error('AI API error:', aiResponse.status, errorText);
        analysis = getDefaultAnalysis(tipoLabel);
      } else {
        const aiData = await aiResponse.json();
        const content = aiData.choices?.[0]?.message?.content;

        if (!content) {
          console.error('No content in AI response');
          analysis = getDefaultAnalysis(tipoLabel);
        } else {
          console.log('AI Response:', content);

          try {
            const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
            analysis = JSON.parse(cleanContent);
          } catch (parseError) {
            console.error('Failed to parse AI response:', parseError);
            analysis = getDefaultAnalysis(tipoLabel);
          }
        }
      }
    } catch (aiError) {
      console.error('AI request failed (non-blocking):', aiError);
      analysis = getDefaultAnalysis(tipoLabel);
    }

    // Update prayer request with analysis
    const { error: updateError } = await supabase
      .from('pedidos_oracao')
      .update({
        analise_ia_titulo: analysis.titulo,
        analise_ia_motivo: analysis.motivo,
        analise_ia_gravidade: analysis.gravidade,
        analise_ia_resposta: analysis.resposta,
        tipo: analysis.motivo?.toLowerCase().replace(/[^a-z]/g, '') || pedido.tipo
      })
      .eq('id', pedido_id)
      .eq('igreja_id', igrejaId);

    if (updateError) {
      console.error('Error updating prayer request:', updateError);
      return new Response(JSON.stringify({ error: 'Failed to save analysis' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[${FUNCTION_NAME}] Analysis saved successfully`);

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
