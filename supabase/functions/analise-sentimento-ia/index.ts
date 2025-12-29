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

// Placeholder - substituir pelo UUID real do pastor de plantão
const UUID_PASTOR_PLANTAO: string = "00000000-0000-0000-0000-000000000000";

const FUNCTION_NAME = 'analise-sentimento-ia';

// ============= FALLBACK DEFAULTS =============
const DEFAULT_MODEL = 'google/gemini-2.5-flash';

const DEFAULT_PROMPT = `Você é um Psicólogo Pastoral experiente de uma igreja cristã. Sua tarefa é analisar relatos de membros e visitantes com empatia profunda e discernimento espiritual.

ANÁLISE REQUERIDA:
1. Avalie a gravidade emocional e espiritual do relato
2. Identifique padrões de risco (ideação suicida, luto intenso, crise familiar, desespero)
3. Resuma o problema de forma concisa
4. Forneça uma análise detalhada para o pastor

CRITÉRIOS DE GRAVIDADE:
- "BAIXA": Situação rotineira, emoção passageira, pedido de oração comum
- "MEDIA": Requer atenção pastoral, acompanhamento recomendado, situação difícil mas estável
- "ALTA": Crise em andamento, sofrimento intenso, necessita contato em 24h
- "CRITICA": Sinais de desespero, luto recente, risco emocional/físico, necessita contato URGENTE

RESPONDA APENAS com JSON válido no formato:
{
  "gravidade": "BAIXA" | "MEDIA" | "ALTA" | "CRITICA",
  "resumo_motivo": "string (máximo 100 caracteres)",
  "analise_profunda": "string (análise detalhada para o pastor, 2-3 parágrafos)"
}`;

// ============= TYPES =============
interface AnaliseIA {
  gravidade: 'BAIXA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  resumo_motivo: string;
  analise_profunda: string;
}

interface RequestPayload {
  telefone: string;
  conteudo_texto: string;
  nome_perfil?: string;
}

interface ChatbotConfig {
  textModel: string;
  systemPrompt: string;
}

// ============= HELPER FUNCTIONS =============

// Fetch chatbot config from database with fallback
async function getChatbotConfig(supabase: SupabaseClient): Promise<ChatbotConfig> {
  try {
    const { data: config, error } = await supabase
      .from('chatbot_configs')
      .select('modelo_texto, role_texto')
      .eq('edge_function_name', FUNCTION_NAME)
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

// Normalize phone number for comparison
function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

// Find or create user in profiles or visitantes_leads
async function identificarUsuario(supabase: SupabaseClient, telefone: string, nomePerfil?: string): Promise<{
  pessoa_id: string | null;
  visitante_id: string | null;
  lider_id: string | null;
  nome: string;
}> {
  const phoneNormalized = normalizePhone(telefone);
  
  // 1. Buscar em profiles pelo telefone
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, nome, user_id')
    .or(`telefone.ilike.%${phoneNormalized}%,telefone.ilike.%${telefone}%`)
    .limit(1)
    .maybeSingle();

  if (profile) {
    console.log(`Usuário encontrado em profiles: ${profile.nome} (${profile.id})`);
    
    // Buscar o lider_id a partir dos times que o membro participa
    let liderId: string | null = null;
    
    const { data: memberships } = await supabase
      .from('membros_time')
      .select(`
        time_id,
        times_culto!inner (
          lider_id
        )
      `)
      .eq('pessoa_id', profile.id)
      .eq('ativo', true)
      .limit(1);

    if (memberships && memberships.length > 0) {
      const timeData = memberships[0].times_culto as { lider_id?: string } | null;
      liderId = timeData?.lider_id || null;
      console.log(`Líder encontrado: ${liderId}`);
    }

    return {
      pessoa_id: profile.id,
      visitante_id: null,
      lider_id: liderId,
      nome: profile.nome
    };
  }

  // 2. Buscar em visitantes_leads
  const { data: visitante, error: visitanteError } = await supabase
    .from('visitantes_leads')
    .select('id, nome, telefone')
    .or(`telefone.ilike.%${phoneNormalized}%,telefone.ilike.%${telefone}%`)
    .limit(1)
    .maybeSingle();

  if (visitante) {
    console.log(`Visitante encontrado: ${visitante.nome || 'Sem nome'} (${visitante.id})`);
    return {
      pessoa_id: null,
      visitante_id: visitante.id,
      lider_id: null,
      nome: visitante.nome || nomePerfil || 'Visitante'
    };
  }

  // 3. Criar novo registro em visitantes_leads
  console.log(`Criando novo visitante para telefone: ${telefone}`);
  const { data: novoVisitante, error: createError } = await supabase
    .from('visitantes_leads')
    .insert({
      telefone: telefone,
      nome: nomePerfil || null,
      origem: 'WABA',
      estagio_funil: 'NOVO'
    })
    .select('id, nome')
    .single();

  if (createError) {
    console.error('Erro ao criar visitante:', createError);
    return {
      pessoa_id: null,
      visitante_id: null,
      lider_id: null,
      nome: nomePerfil || 'Desconhecido'
    };
  }

  console.log(`Novo visitante criado: ${novoVisitante.id}`);
  return {
    pessoa_id: null,
    visitante_id: novoVisitante.id,
    lider_id: null,
    nome: novoVisitante.nome || nomePerfil || 'Visitante'
  };
}

// Analyze content with AI using dynamic config
async function analisarComIA(conteudo: string, nomePessoa: string, config: ChatbotConfig): Promise<AnaliseIA> {
  const defaultAnalysis: AnaliseIA = {
    gravidade: 'BAIXA',
    resumo_motivo: 'Análise não disponível',
    analise_profunda: 'Não foi possível analisar o conteúdo. Recomenda-se revisão manual.'
  };

  if (!LOVABLE_API_KEY) {
    console.error('LOVABLE_API_KEY não configurada');
    return defaultAnalysis;
  }

  const userPrompt = `Nome da pessoa: ${nomePessoa}

Relato/Mensagem:
"${conteudo}"

Analise este relato e forneça sua avaliação pastoral.`;

  try {
    console.log(`[${FUNCTION_NAME}] Calling AI with model: ${config.textModel}`);
    
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro na API de IA:', response.status, errorText);
      return defaultAnalysis;
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content;

    if (!content) {
      console.error('Sem conteúdo na resposta da IA');
      return defaultAnalysis;
    }

    console.log('Resposta da IA:', content);

    // Parse JSON response
    const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleanContent) as AnaliseIA;

    // Validate and normalize gravidade
    const gravidadeValida = ['BAIXA', 'MEDIA', 'ALTA', 'CRITICA'].includes(parsed.gravidade.toUpperCase());
    
    return {
      gravidade: gravidadeValida ? parsed.gravidade.toUpperCase() as AnaliseIA['gravidade'] : 'MEDIA',
      resumo_motivo: parsed.resumo_motivo?.substring(0, 100) || 'Não identificado',
      analise_profunda: parsed.analise_profunda || 'Análise não disponível'
    };

  } catch (error) {
    console.error('Erro ao analisar com IA:', error);
    return defaultAnalysis;
  }
}

// Determine pastor responsável
function determinarPastorResponsavel(liderId: string | null): string {
  if (liderId) {
    console.log(`Roteando para líder: ${liderId}`);
    return liderId;
  }
  console.log(`Roteando para pastor de plantão: ${UUID_PASTOR_PLANTAO}`);
  return UUID_PASTOR_PLANTAO;
}

// ============= MAIN HANDLER =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const payload: RequestPayload = await req.json();
    const { telefone, conteudo_texto, nome_perfil } = payload;

    // Validation
    if (!telefone || !conteudo_texto) {
      console.error('Campos obrigatórios ausentes:', { telefone: !!telefone, conteudo_texto: !!conteudo_texto });
      return new Response(JSON.stringify({ 
        error: 'Campos obrigatórios: telefone, conteudo_texto' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`=== Iniciando análise de sentimento ===`);
    console.log(`Telefone: ${telefone}`);
    console.log(`Nome: ${nome_perfil || 'Não informado'}`);
    console.log(`Conteúdo: ${conteudo_texto.substring(0, 100)}...`);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 0. Fetch dynamic config from database
    const config = await getChatbotConfig(supabase);

    // 1. Identificar usuário
    const usuario = await identificarUsuario(supabase, telefone, nome_perfil);
    console.log(`Usuário identificado:`, usuario);

    // 2. Analisar com IA (usando config dinâmica)
    const analise = await analisarComIA(conteudo_texto, usuario.nome, config);
    console.log(`Análise da IA:`, analise);

    // 3. Verificar se deve gravar (apenas MEDIA, ALTA, CRITICA)
    if (analise.gravidade === 'BAIXA') {
      console.log('Gravidade BAIXA - não será criado atendimento');
      
      const executionTime = Date.now() - startTime;
      
      // Log execution
      try {
        await supabase.rpc('log_edge_function_with_metrics', {
          p_function_name: FUNCTION_NAME,
          p_status: 'success',
          p_execution_time_ms: executionTime,
          p_request_payload: { telefone, nome_perfil, gravidade: 'BAIXA' },
          p_response_payload: { atendimento_criado: false, gravidade: 'BAIXA' }
        });
      } catch (logError) {
        console.error('Log error:', logError);
      }

      return new Response(JSON.stringify({ 
        success: true,
        atendimento_criado: false,
        gravidade: analise.gravidade,
        mensagem: 'Gravidade baixa - sem necessidade de atendimento pastoral'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 4. Determinar pastor responsável
    const pastorResponsavelId = determinarPastorResponsavel(usuario.lider_id);

    // 5. Criar registro em atendimentos_pastorais
    const historicoInicial = [{
      data: new Date().toISOString(),
      autor: 'IA',
      nota: analise.analise_profunda
    }];

    const atendimentoData = {
      pessoa_id: usuario.pessoa_id,
      visitante_id: usuario.visitante_id,
      origem: 'SENTIMENTOS',
      motivo_resumo: `[IA DETECTOU] ${analise.resumo_motivo}`,
      conteudo_original: conteudo_texto,
      gravidade: analise.gravidade.toLowerCase(),
      pastor_responsavel_id: pastorResponsavelId,
      status: 'pendente',
      historico_evolucao: historicoInicial
    };

    console.log('Criando atendimento pastoral:', atendimentoData);

    const { data: atendimento, error: insertError } = await supabase
      .from('atendimentos_pastorais')
      .insert(atendimentoData)
      .select('id')
      .single();

    if (insertError) {
      console.error('Erro ao criar atendimento:', insertError);
      return new Response(JSON.stringify({ 
        error: 'Falha ao criar atendimento pastoral',
        details: insertError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`✅ Atendimento criado com sucesso: ${atendimento.id}`);

    // 6. Notificar admins para casos críticos
    if (analise.gravidade === 'CRITICA' || analise.gravidade === 'ALTA') {
      try {
        await supabase.rpc('notify_admins', {
          p_title: `🚨 Alerta Pastoral [${analise.gravidade}]`,
          p_message: `${usuario.nome}: ${analise.resumo_motivo}`,
          p_type: 'alerta_gabinete_pastoral',
          p_related_user_id: null,
          p_metadata: {
            atendimento_id: atendimento.id,
            pessoa_nome: usuario.nome,
            gravidade: analise.gravidade,
            pastor_responsavel_id: pastorResponsavelId
          }
        });
      } catch (notifyError) {
        console.error('Erro ao notificar admins:', notifyError);
      }
    }

    const executionTime = Date.now() - startTime;

    // Log execution
    try {
      await supabase.rpc('log_edge_function_with_metrics', {
        p_function_name: FUNCTION_NAME,
        p_status: 'success',
        p_execution_time_ms: executionTime,
        p_request_payload: { telefone, nome_perfil, gravidade: analise.gravidade },
        p_response_payload: { 
          atendimento_criado: true, 
          atendimento_id: atendimento.id,
          gravidade: analise.gravidade,
          pastor_id: pastorResponsavelId
        }
      });
    } catch (logError) {
      console.error('Log error:', logError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      atendimento_criado: true,
      atendimento_id: atendimento.id,
      gravidade: analise.gravidade,
      pastor_responsavel_id: pastorResponsavelId,
      resumo: analise.resumo_motivo
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro inesperado:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
