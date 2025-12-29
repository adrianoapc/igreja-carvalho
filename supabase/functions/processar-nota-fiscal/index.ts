import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const FUNCTION_NAME = 'processar-nota-fiscal';

// Default config if not in database
const DEFAULT_MODEL = 'google/gemini-2.5-pro';
const DEFAULT_VISION_PROMPT = `Você é um assistente especializado em extrair informações de notas fiscais brasileiras (NFe, NFCe, cupons fiscais, etc).
             
Analise a imagem da nota fiscal e extraia as seguintes informações:
- CNPJ ou CPF do fornecedor/emissor
- Nome/Razão Social do fornecedor
- Data de emissão (formato YYYY-MM-DD)
- Valor total
- Data de vencimento (se houver, formato YYYY-MM-DD)
- Descrição dos itens/serviços
- Número da nota fiscal

Retorne os dados no formato estruturado solicitado. Se algum campo não estiver visível, retorne null.`;

// Fetch chatbot config from database
async function getChatbotConfig(supabase: SupabaseClient): Promise<{ model: string; systemPrompt: string }> {
  try {
    const { data: config, error } = await supabase
      .from('chatbot_configs')
      .select('modelo_visao, role_visao')
      .eq('edge_function_name', FUNCTION_NAME)
      .eq('ativo', true)
      .single();

    if (error || !config) {
      console.log(`No config found for ${FUNCTION_NAME}, using defaults`);
      return { model: DEFAULT_MODEL, systemPrompt: DEFAULT_VISION_PROMPT };
    }

    return {
      model: config.modelo_visao || DEFAULT_MODEL,
      systemPrompt: config.role_visao || DEFAULT_VISION_PROMPT
    };
  } catch (err) {
    console.error('Error fetching chatbot config:', err);
    return { model: DEFAULT_MODEL, systemPrompt: DEFAULT_VISION_PROMPT };
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Sessão inválida' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: userRoles, error: rolesError } = await supabaseAuth
      .from('user_app_roles')
      .select('role:app_roles(name)')
      .eq('user_id', user.id);

    if (rolesError) {
      console.error('Roles error:', rolesError);
      return new Response(
        JSON.stringify({ error: 'Erro ao verificar permissões' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasPermission = userRoles?.some((ur: Record<string, unknown>) => 
      ['admin', 'tesoureiro', 'pastor'].includes((ur.role as Record<string, unknown>)?.name?.toString()?.toLowerCase() || '')
    );

    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Requer papel de admin ou tesoureiro.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { imageBase64, mimeType } = await req.json();
    
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Imagem não fornecida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (imageBase64.length > MAX_IMAGE_SIZE * 1.4) {
      return new Response(
        JSON.stringify({ error: 'Imagem muito grande. Tamanho máximo: 10MB' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (mimeType && !allowedMimeTypes.includes(mimeType)) {
      return new Response(
        JSON.stringify({ error: 'Tipo de imagem não suportado' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processando nota fiscal para usuário ${user.id}...`);

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Serviço de processamento não configurado' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client to fetch config
    const supabaseService = createClient(supabaseUrl, supabaseServiceKey);
    const { model, systemPrompt } = await getChatbotConfig(supabaseService);
    console.log(`Using model: ${model}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Extraia as informações desta nota fiscal:'
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'extrair_nota_fiscal',
              description: 'Extrai informações estruturadas de uma nota fiscal',
              parameters: {
                type: 'object',
                properties: {
                  fornecedor_cnpj_cpf: {
                    type: 'string',
                    description: 'CNPJ ou CPF do fornecedor (apenas números)'
                  },
                  fornecedor_nome: {
                    type: 'string',
                    description: 'Nome ou Razão Social do fornecedor'
                  },
                  data_emissao: {
                    type: 'string',
                    description: 'Data de emissão no formato YYYY-MM-DD'
                  },
                  valor_total: {
                    type: 'number',
                    description: 'Valor total da nota fiscal'
                  },
                  data_vencimento: {
                    type: 'string',
                    description: 'Data de vencimento se houver, formato YYYY-MM-DD, ou null'
                  },
                  descricao: {
                    type: 'string',
                    description: 'Descrição resumida dos itens/serviços'
                  },
                  numero_nota: {
                    type: 'string',
                    description: 'Número da nota fiscal'
                  },
                  tipo_documento: {
                    type: 'string',
                    enum: ['nfe', 'nfce', 'cupom_fiscal', 'recibo', 'outro'],
                    description: 'Tipo de documento fiscal'
                  }
                },
                required: ['fornecedor_nome', 'data_emissao', 'valor_total', 'descricao'],
                additionalProperties: false
              }
            }
          }
        ],
        tool_choice: { type: 'function', function: { name: 'extrair_nota_fiscal' } }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.error('Rate limit atingido');
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente em alguns instantes.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.error('Pagamento necessário');
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes no Lovable AI. Adicione créditos em Settings → Workspace → Usage.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('Erro na API:', response.status, errorText);
      throw new Error('Erro ao processar imagem');
    }

    const data = await response.json();
    console.log('Resposta da IA recebida');

    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || toolCall.function?.name !== 'extrair_nota_fiscal') {
      throw new Error('Resposta da IA não contém dados estruturados');
    }

    const notaFiscalData = JSON.parse(toolCall.function.arguments);
    console.log('Dados extraídos com sucesso');

    return new Response(
      JSON.stringify({ 
        success: true, 
        dados: notaFiscalData 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro ao processar nota fiscal:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro ao processar nota fiscal. Tente novamente.'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
