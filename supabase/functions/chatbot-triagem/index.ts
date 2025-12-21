import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

// --- INTERFACES ---
interface RequestBody {
  telefone: string;
  nome_perfil: string;
  tipo_mensagem?: 'text' | 'audio' | 'image';
  conteudo_texto?: string;
  media_id?: string;
}

// --- CONFIGURAÇÃO ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const WHATSAPP_API_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN');
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const FUNCTION_NAME = 'chatbot-triagem';

// ⚠️ CONFIGURAÇÃO DE PASTORAL
// Substitua pelo UUID real de um usuário "Pastor Plantão" na tabela profiles
const UUID_PASTOR_PLANTAO: string | null = "a4097879-f52a-4bf2-86e6-62ad02a06268"; 
const TELEFONE_PASTOR_PLANTAO = "5517988216456"; // Para envio de alerta via Make

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const DEFAULT_SYSTEM_PROMPT = `
Você é da Equipe de Acolhimento da Igreja Carvalho.
REGRAS: 1. Nunca diga que é IA. 2. Use a FAQ. 
FLUXOS: 
- ORAÇÃO: Colete dados -> JSON (intencao: PEDIDO_ORACAO).
- PASTOR: Pergunte motivo -> JSON (intencao: SOLICITACAO_PASTORAL).
- TESTEMUNHO: Colete relato -> JSON (intencao: TESTEMUNHO).
FAQ: Cultos Dom 18h30/Qui 19h30. End: Av. Gabriel Jorge Cury 232.

JSON FINAL:
\`\`\`json
{
  "concluido": true,
  "intencao": "PEDIDO_ORACAO" | "TESTEMUNHO" | "SOLICITACAO_PASTORAL",
  "nome_final": "...",
  "motivo_resumo": "...",
  "texto_na_integra": "...",
  "categoria": "SAUDE|FAMILIA|FINANCEIRO|ESPIRITUAL|GABINETE|OUTROS",
  "anonimo": false,
  "publicar": false,
  "notificar_admin": false
}
\`\`\`
`;

const DEFAULT_TEXT_MODEL = 'gpt-4o-mini';
const DEFAULT_AUDIO_MODEL = 'whisper-1';

// --- CONFIGURAÇÃO (DB) ---
async function getChatbotConfig() {
  try {
    const { data: config } = await supabase
      .from('chatbot_configs')
      .select('modelo_texto, modelo_audio, role_texto')
      .eq('edge_function_name', FUNCTION_NAME)
      .eq('ativo', true)
      .maybeSingle();

    if (!config) return { textModel: DEFAULT_TEXT_MODEL, audioModel: DEFAULT_AUDIO_MODEL, systemPrompt: DEFAULT_SYSTEM_PROMPT };
    return {
      textModel: config.modelo_texto || DEFAULT_TEXT_MODEL,
      audioModel: config.modelo_audio || DEFAULT_AUDIO_MODEL,
      systemPrompt: config.role_texto || DEFAULT_SYSTEM_PROMPT
    };
  } catch (e) {
    return { textModel: DEFAULT_TEXT_MODEL, audioModel: DEFAULT_AUDIO_MODEL, systemPrompt: DEFAULT_SYSTEM_PROMPT };
  }
}

// --- LIMPEZA DE JSON ---
function extractJsonAndText(aiContent: string) {
  let cleanText = aiContent;
  let parsedJson: any = null;

  try {
    const markdownMatch = aiContent.match(/```(?:json)?([\s\S]*?)```/i);
    if (markdownMatch && markdownMatch[1]) {
      try {
        parsedJson = JSON.parse(markdownMatch[1].trim());
        cleanText = aiContent.replace(markdownMatch[0], '').trim();
      } catch (e) {}
    }
    
    if (!parsedJson) {
      const firstOpen = aiContent.indexOf('{');
      const lastClose = aiContent.lastIndexOf('}');
      if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
         try {
            const tempJson = JSON.parse(aiContent.substring(firstOpen, lastClose + 1));
            if (tempJson.concluido) {
                parsedJson = tempJson;
                cleanText = aiContent.substring(0, firstOpen).trim();
            }
         } catch (e) {}
      }
    }
  } catch (e) {}
  
  cleanText = (cleanText || aiContent).replace(/```json/g, '').replace(/```/g, '').trim();
  return { cleanText, parsedJson };
}

// --- ROTEAMENTO DE PASTOR (LÓGICA DE INTELIGÊNCIA) ---
async function definirPastorResponsavel(perfilUsuario: any): Promise<string | null> {
  // 1. Se tem líder cadastrado, tenta mandar pro líder
  if (perfilUsuario?.lider_id) {
      // Opcional: Você pode adicionar uma verificação aqui se o lider_id é realmente um pastor
      // const { data: lider } = await supabase.from('profiles').select('role').eq('id', perfilUsuario.lider_id).single();
      // if (lider?.role === 'PASTOR') return perfilUsuario.lider_id;
      
      // Por enquanto, assume que o líder cuida:
      return perfilUsuario.lider_id;
  }
  // 2. Fallback: Pastor de Plantão (Gabinete Geral)
  return UUID_PASTOR_PLANTAO;
}

// --- ÁUDIO ---
async function processarAudio(mediaId: string, audioModel: string): Promise<string | null> {
  try {
    if (!WHATSAPP_API_TOKEN || !OPENAI_API_KEY) return null;
    const urlRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, { headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } });
    const mediaData = await urlRes.json();
    if (!mediaData.url) return null;
    const audioRes = await fetch(mediaData.url, { headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } });
    const blob = await audioRes.blob();
    const formData = new FormData();
    formData.append('file', blob, 'audio.ogg');
    formData.append('model', audioModel);
    const openAiRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` }, body: formData
    });
    const data = await openAiRes.json();
    return data.text;
  } catch (e) { return null; }
}

// --- SERVIDOR PRINCIPAL ---
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  
  const startTime = Date.now();
  let requestPayload: any = {};

  try {
    const body = await req.json() as RequestBody;
    requestPayload = body;
    const { telefone, nome_perfil, tipo_mensagem, media_id } = body;
    let { conteudo_texto } = body;

    // 1. Configuração
    const config = await getChatbotConfig();

    // 2. Processamento de Áudio
    if (tipo_mensagem === 'audio' && media_id) {
      const transcricao = await processarAudio(media_id, config.audioModel);
      conteudo_texto = transcricao ? `[Áudio Transcrito]: ${transcricao}` : "[Erro áudio]";
    }
    const inputTexto = conteudo_texto || "";

    // 3. Gestão de Sessão
    let { data: sessao } = await supabase.from('atendimentos_bot')
      .select('*').eq('telefone', telefone).neq('status', 'CONCLUIDO')
      .gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).maybeSingle();

    let historico = sessao ? sessao.historico_conversa : [];

    if (!sessao) {
      const { data: nova, error } = await supabase.from('atendimentos_bot')
        .insert({ telefone, status: 'INICIADO', historico_conversa: [] }).select().single();
      if (error || !nova) throw new Error("Erro ao criar sessão no banco de dados.");
      sessao = nova;
    }

    // Log de Entrada
    await supabase.from('logs_auditoria_chat').insert({ sessao_id: sessao.id, ator: 'USER', payload_raw: { texto: inputTexto } });

    // 4. Chamada IA
    const messages = [
      { role: "system", content: config.systemPrompt },
      { role: "system", content: `CTX: Tel ${telefone}, Nome ${nome_perfil}.` },
      ...historico.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: inputTexto }
    ];

    let aiContent = "";
    // Seletor de Modelo (Lovable vs OpenAI)
    if (config.textModel.startsWith('google/') && LOVABLE_API_KEY) {
       const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
         method: 'POST', headers: { 'Authorization': `Bearer ${LOVABLE_API_KEY}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({ model: config.textModel, messages })
       });
       const data = await res.json();
       aiContent = data.choices?.[0]?.message?.content || "";
    } else {
       const res = await fetch('https://api.openai.com/v1/chat/completions', {
         method: 'POST', headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
         body: JSON.stringify({ model: config.textModel, messages, temperature: 0.3 })
       });
       const data = await res.json();
       aiContent = data.choices?.[0]?.message?.content || "";
    }

    // 5. Limpeza e Extração
    const { cleanText, parsedJson } = extractJsonAndText(aiContent);
    let responseMessage = cleanText;
    let notificarAdmin = false;

    // 6. Lógica de Negócio (DUAL WRITE: Legado + Novo Módulo Pastoral)
    if (parsedJson?.concluido) {
      // Fecha Sessão
      await supabase.from('atendimentos_bot').update({
        status: 'CONCLUIDO',
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);

      // --- A. GESTÃO DE IDENTIDADE (QUEM É?) ---
      // Buscamos profiles que compartilham o mesmo telefone (pode haver duplicatas: pai e filho, etc.)
      const { data: perfis, error: perfilError } = await supabase
        .from('profiles')
        .select('id, nome, lider_id, data_nascimento, created_at') 
        .eq('telefone', telefone)
        .limit(5);
      
      let profile: { id: string; nome: string; lider_id?: string; data_nascimento?: string; created_at?: string } | null = null;
      
      if (perfis && perfis.length > 0) {
        if (perfis.length > 1) {
          // DUPLICIDADE DETECTADA - Aplicar lógica de "Melhor Candidato"
          console.warn(`Alerta: Telefone ${telefone} vinculado a múltiplos perfis (IDs: ${perfis.map(p => p.id).join(', ')})`);
          
          // Ordena: Prioriza quem tem data_nascimento mais antiga (assume-se ser pai/mãe, não criança)
          // Em seguida, prioriza cadastro mais antigo (created_at)
          perfis.sort((a, b) => {
            // Se ambos têm data de nascimento, quem nasceu antes (mais velho) tem prioridade
            const dataA = a.data_nascimento ? new Date(a.data_nascimento).getTime() : Infinity;
            const dataB = b.data_nascimento ? new Date(b.data_nascimento).getTime() : Infinity;
            
            if (dataA !== dataB) {
              return dataA - dataB; // Mais velho primeiro
            }
            
            // Empate: quem foi cadastrado primeiro
            const createdA = a.created_at ? new Date(a.created_at).getTime() : Infinity;
            const createdB = b.created_at ? new Date(b.created_at).getTime() : Infinity;
            return createdA - createdB;
          });
          
          console.warn(`Selecionado perfil ID: ${perfis[0].id} (${perfis[0].nome})`);
        }
        
        profile = perfis[0];
      }
        
      let visitanteId = null;
      let origem = 'WABA_INTERNO';
      let pastorResponsavelId = null;

      if (!profile) {
        origem = 'WABA_EXTERNO';
        // Gestão de Lead Visitante
        const { data: lead } = await supabase.from('visitantes_leads').select('id').eq('telefone', telefone).maybeSingle();
        if (lead) visitanteId = lead.id;
        else {
            const { data: newLead } = await supabase.from('visitantes_leads').insert({ 
                telefone, nome: parsedJson.nome_final || nome_perfil, origem: 'BOT' 
            }).select('id').single();
            visitanteId = newLead?.id;
        }
        // Visitantes não tem líder, vão para o Plantão/Gabinete Geral
        pastorResponsavelId = UUID_PASTOR_PLANTAO;
      } else {
        // Membros: Roteamento inteligente para o Líder ou Plantão
        pastorResponsavelId = await definirPastorResponsavel(profile);
      }

      // --- B. GRAVAÇÃO (LEGADO + NOVO) ---

      // CASO 1: PEDIDO DE ORAÇÃO
      if (parsedJson.intencao === 'PEDIDO_ORACAO') {
        // 1. Tabela Antiga (Legado)
        await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: parsedJson.motivo_resumo,
          texto_na_integra: parsedJson.texto_na_integra,
          analise_ia_motivo: parsedJson.categoria,
          anonimo: parsedJson.anonimo || false,
          origem, membro_id: profile?.id, visitante_id: visitanteId
        });
        
        // 2. Tabela Nova (Gabinete Digital) 
        // Só criamos atendimento pastoral se NÃO for anônimo (ou cria com flag oculta, dependendo da sua regra)
        if (!parsedJson.anonimo) {
            await supabase.from('atendimentos_pastorais').insert({
                pessoa_id: profile?.id,
                visitante_id: visitanteId,
                origem: 'CHATBOT',
                motivo_resumo: `[ORAÇÃO] ${parsedJson.motivo_resumo}`,
                conteudo_original: parsedJson.texto_na_integra,
                gravidade: 'BAIXA', 
                pastor_responsavel_id: pastorResponsavelId,
                status: 'PENDENTE'
            });
        }
        
        responseMessage = parsedJson.anonimo ? "Anotado em sigilo. 🙏" : `Anotado, ${parsedJson.nome_final}! 🙏`;
      }

      // CASO 2: SOLICITAÇÃO PASTORAL (Crítico/Gabinete)
      else if (parsedJson.intencao === 'SOLICITACAO_PASTORAL') {
        // 1. Tabela Antiga
        await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: `[PASTORAL] ${parsedJson.motivo_resumo}`,
          texto_na_integra: parsedJson.texto_na_integra,
          analise_ia_motivo: 'GABINETE_PASTORAL',
          analise_ia_gravidade: 'ALTA',
          origem, membro_id: profile?.id, visitante_id: visitanteId
        });

        // 2. Tabela Nova (Onde o Pastor/Secretária vai trabalhar)
        await supabase.from('atendimentos_pastorais').insert({
            pessoa_id: profile?.id,
            visitante_id: visitanteId,
            origem: 'CHATBOT',
            motivo_resumo: `[GABINETE] ${parsedJson.motivo_resumo}`,
            conteudo_original: parsedJson.texto_na_integra,
            gravidade: 'MEDIA', // Começa média para triagem
            pastor_responsavel_id: pastorResponsavelId,
            status: 'PENDENTE'
        });

        notificarAdmin = true;
        responseMessage = `Entendido. Já notifiquei a liderança sobre: "${parsedJson.motivo_resumo}".`;
      }

      // CASO 3: TESTEMUNHO
      else if (parsedJson.intencao === 'TESTEMUNHO') {
        await supabase.from('testemunhos').insert({
          titulo: parsedJson.motivo_resumo, mensagem: parsedJson.texto_na_integra, publicar: parsedJson.publicar || false,
          origem, autor_id: profile?.id, visitante_id: visitanteId
        });
        // Testemunho não gera atendimento pastoral automático por enquanto
        responseMessage = parsedJson.publicar ? "Glória a Deus! 🙌" : "Amém! Salvo.";
      }

    } else {
      // Conversa continua
      await supabase.from('atendimentos_bot').update({
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);
    }

    // Logs & Métricas
    await supabase.from('logs_auditoria_chat').insert({ sessao_id: sessao.id, ator: 'BOT', payload_raw: { resposta: responseMessage, json: parsedJson } });
    
    const executionTime = Date.now() - startTime;
    try {
        await supabase.rpc('log_edge_function_with_metrics', {
            p_function_name: FUNCTION_NAME, p_status: 'success', p_execution_time_ms: executionTime,
            p_request_payload: requestPayload, p_response_payload: { reply: responseMessage, admin: notificarAdmin }
        });
    } catch (e) {}

    // 7. Retorno para o Make
    return new Response(JSON.stringify({ 
      reply_message: responseMessage, 
      notificar_admin: notificarAdmin, 
      telefone_admin_destino: TELEFONE_PASTOR_PLANTAO,
      dados_contato: { 
        telefone_usuario: telefone, 
        nome_usuario: parsedJson?.nome_final || nome_perfil, 
        motivo: parsedJson?.motivo_resumo || ""
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("ERRO FATAL:", msg);
    return new Response(JSON.stringify({ error: 'Erro interno', details: msg }), { status: 500, headers: corsHeaders });
  }
});
