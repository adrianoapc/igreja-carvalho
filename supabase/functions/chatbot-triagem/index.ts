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

interface ChatResponse {
  concluido?: boolean;
  intencao?: 'PEDIDO_ORACAO' | 'TESTEMUNHO' | 'SOLICITACAO_PASTORAL' | 'DUVIDA_IGREJA' | 'OUTRO';
  nome_final?: string;
  motivo_resumo?: string;
  texto_na_integra?: string;
  categoria?: string;
  anonimo?: boolean;
  publicar?: boolean;
  notificar_admin?: boolean;
}

// --- CONFIGURAÇÃO ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const WHATSAPP_API_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const FUNCTION_NAME = 'chatbot-triagem';

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// Default prompt if not configured in database
const DEFAULT_SYSTEM_PROMPT = `🕊️ PROMPT FINAL – ACOLHIMENTO DIGITAL
Igreja Carvalho – Versão Compacta, com Fallback + Auto-categoria

🎯 PAPEL
Você é da Equipe de Acolhimento Digital da Igreja Carvalho.
Atue como uma pessoa real, cristã, acolhedora e objetiva.
Use linguagem humana, empática e pastoral (nunca técnica).

⛔ REGRAS CRÍTICAS
- Nunca diga que é IA, robô ou sistema.
  Se perguntarem: "Sou da equipe de apoio da Igreja Carvalho."
- Nunca gere JSON fora dos fluxos 2, 3 ou 4.
- Nunca invente dados. Use apenas a FAQ.
- Nunca peça nome ou telefone se já estiverem no contexto da mensagem. Só pergunte nome se ausente, ambíguo ou parecer empresa.

📘 FAQ – RESPOSTAS FIXAS
- Horários dos cultos: Domingo 18h30 | Quinta 19h30 (Culto de Ensino)
- Endereço: Av. Gabriel Jorge Cury, 232 – Parque Municipal – São José do Rio Preto/SP (Próx. Teixeirão)
- Pix (Dízimos/Ofertas): CNPJ: 60.103.122/0001-35
- Secretaria: (17) 99198-5016 (Seg-Sex, 9h–17h)

🚦 FLUXO PRINCIPAL
1️⃣ DÚVIDA SOBRE A IGREJA
- Responda com a informação da FAQ.
- Finalize com: "Posso ajudar com algum pedido de oração hoje? 🙏"
- Não gere JSON.

2️⃣ PEDIDO DE ORAÇÃO
- Use nome e telefone do contexto. Só pergunte nome se ausente ou ambíguo.
- Se necessário, pergunte o motivo do pedido.
- Depois pergunte: "Prefere anônimo ou posso compartilhar com a equipe?"
- Gere JSON somente ao final. Preencha categoria automaticamente.

3️⃣ TESTEMUNHO
- Peça o relato com carinho: "Pode nos contar seu testemunho?"
- Pergunte: "Podemos publicar ou prefere manter restrito?"
- Gere JSON ao final.

4️⃣ FALAR COM UM PASTOR
- Pergunte: "Pode me contar brevemente sobre o assunto?"
- Depois diga: "Tudo bem, já avisei o pastor."
- Gere JSON com categoria "GABINETE".

🛟 FALLBACK UNIVERSAL
Se a intenção não estiver clara:
- Faça uma pergunta simples:
  - "Pode me explicar melhor como posso te ajudar?"
  - "Sinto muito. Quer me contar mais?"
  - "Oi 😊 Como posso te ajudar hoje?"
- Nunca gere JSON.
- Nunca assuma intenção.
- Nunca peça dados.

🧠 AUTO-CATEGORIA (FLUXO 2)
No JSON de oração, preencha o campo "categoria" automaticamente.
Categorias válidas: SAUDE, FAMILIA, FINANCEIRO, ESPIRITUAL, OUTROS.
Use a que mais se aplica. Se não houver correspondência clara, use OUTROS.

📦 JSON (APENAS AO FINAL DOS FLUXOS 2, 3 E 4)

PEDIDO_ORACAO:
{
  "concluido": true,
  "intencao": "PEDIDO_ORACAO",
  "nome_final": "",
  "motivo_resumo": "",
  "texto_na_integra": "",
  "categoria": "",
  "anonimo": true
}

TESTEMUNHO:
{
  "concluido": true,
  "intencao": "TESTEMUNHO",
  "nome_final": "",
  "motivo_resumo": "",
  "texto_na_integra": "",
  "publicar": false
}

SOLICITACAO_PASTORAL:
{
  "concluido": true,
  "intencao": "SOLICITACAO_PASTORAL",
  "nome_final": "",
  "motivo_resumo": "",
  "texto_na_integra": "",
  "categoria": "GABINETE"
}

✅ RESUMO DO COMPORTAMENTO
- Nunca mencione ser IA
- Nunca antecipe JSON
- Sempre use tom humano e cristão
- Nunca julgue ou corrija o tom do usuário
- Gere JSON limpo, sem texto junto
- Use fallback quando necessário
- Preencha categoria automaticamente
- Ao final da conversa, inclua: "✨ Seus dados ficam protegidos com carinho e são usados apenas para te acolher melhor, conforme a LGPD."
`;

const DEFAULT_TEXT_MODEL = 'gpt-4o-mini';
const DEFAULT_AUDIO_MODEL = 'whisper-1';

interface ChatbotConfig {
  textModel: string;
  audioModel: string;
  systemPrompt: string;
  audioPrompt: string | null;
}

// Fetch chatbot config from database
async function getChatbotConfig(): Promise<ChatbotConfig> {
  console.log('🔧 [CONFIG] Iniciando busca de configuração...');
  console.log(`🔧 [CONFIG] Function name: ${FUNCTION_NAME}`);
  
  try {
    const { data: config, error } = await supabase
      .from('chatbot_configs')
      .select('modelo_texto, modelo_audio, role_texto, role_audio')
      .eq('edge_function_name', FUNCTION_NAME)
      .eq('ativo', true)
      .single();

    if (error) {
      console.log(`⚠️ [CONFIG] Erro na busca: ${error.message}`);
      console.log(`⚠️ [CONFIG] Código do erro: ${error.code}`);
      console.log(`⚠️ [CONFIG] Usando configuração padrão`);
      return {
        textModel: DEFAULT_TEXT_MODEL,
        audioModel: DEFAULT_AUDIO_MODEL,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        audioPrompt: null
      };
    }

    if (!config) {
      console.log(`⚠️ [CONFIG] Nenhuma config encontrada para ${FUNCTION_NAME}`);
      console.log(`⚠️ [CONFIG] Usando configuração padrão`);
      return {
        textModel: DEFAULT_TEXT_MODEL,
        audioModel: DEFAULT_AUDIO_MODEL,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        audioPrompt: null
      };
    }

    console.log(`✅ [CONFIG] Configuração encontrada!`);
    console.log(`✅ [CONFIG] modelo_texto: ${config.modelo_texto || 'não definido'}`);
    console.log(`✅ [CONFIG] modelo_audio: ${config.modelo_audio || 'não definido'}`);
    console.log(`✅ [CONFIG] role_texto presente: ${!!config.role_texto}`);
    console.log(`✅ [CONFIG] role_audio presente: ${!!config.role_audio}`);

    return {
      textModel: config.modelo_texto || DEFAULT_TEXT_MODEL,
      audioModel: config.modelo_audio || DEFAULT_AUDIO_MODEL,
      systemPrompt: config.role_texto || DEFAULT_SYSTEM_PROMPT,
      audioPrompt: config.role_audio || null
    };
  } catch (err) {
    console.error('❌ [CONFIG] Erro inesperado:', err);
    return {
      textModel: DEFAULT_TEXT_MODEL,
      audioModel: DEFAULT_AUDIO_MODEL,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      audioPrompt: null
    };
  }
}

// --- FUNÇÕES AUXILIARES ---
async function processarAudio(mediaId: string, audioModel: string): Promise<string | null> {
  console.log(`🎤 [AUDIO] Iniciando processamento de áudio...`);
  console.log(`🎤 [AUDIO] Media ID: ${mediaId}`);
  console.log(`🎤 [AUDIO] Modelo: ${audioModel}`);
  
  try {
    if (!WHATSAPP_API_TOKEN) {
      console.log('❌ [AUDIO] WHATSAPP_API_TOKEN não configurado');
      return null;
    }
    if (!OPENAI_API_KEY) {
      console.log('❌ [AUDIO] OPENAI_API_KEY não configurado');
      return null;
    }
    
    console.log('🎤 [AUDIO] Buscando URL da mídia no WhatsApp...');
    const mediaUrlRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, { 
      headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } 
    });
    const mediaData = await mediaUrlRes.json();
    
    if (!mediaData.url) {
      console.log('❌ [AUDIO] URL da mídia não encontrada');
      console.log('❌ [AUDIO] Resposta:', JSON.stringify(mediaData));
      return null;
    }
    
    console.log('🎤 [AUDIO] URL obtida, baixando áudio...');
    const audioRes = await fetch(mediaData.url, { 
      headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } 
    });
    const audioBlob = await audioRes.blob();
    console.log(`🎤 [AUDIO] Áudio baixado, tamanho: ${audioBlob.size} bytes`);
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', audioModel);
    
    console.log('🎤 [AUDIO] Enviando para transcrição...');
    const transRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData
    });
    
    const data = await transRes.json();
    console.log(`✅ [AUDIO] Transcrição concluída: "${data.text?.substring(0, 100)}..."`);
    return data.text;
  } catch (e) {
    console.error("❌ [AUDIO] Erro no processamento:", e);
    return null;
  }
}

async function getOrCreateLead(telefone: string, nome: string) {
  console.log(`👤 [LEAD] Buscando/criando lead para telefone: ${telefone}`);
  
  const { data: existing } = await supabase.from('visitantes_leads').select('id').eq('telefone', telefone).maybeSingle();
  if (existing) {
    console.log(`👤 [LEAD] Lead existente encontrado: ${existing.id}`);
    await supabase.from('visitantes_leads').update({ data_ultimo_contato: new Date() }).eq('id', existing.id);
    return existing.id;
  }
  
  console.log(`👤 [LEAD] Criando novo lead...`);
  const { data: newLead } = await supabase.from('visitantes_leads').insert({
      telefone, nome: nome || 'Visitante WhatsApp', origem: 'WABA_BOT', estagio_funil: 'NOVO', data_ultimo_contato: new Date()
  }).select('id').single();
  console.log(`✅ [LEAD] Novo lead criado: ${newLead?.id}`);
  return newLead?.id;
}

// Check if model is from Lovable AI or OpenAI
function isLovableModel(model: string): boolean {
  const isLovable = model.startsWith('google/') || model.startsWith('openai/gpt-5');
  console.log(`🤖 [MODEL] Verificando modelo "${model}" - isLovable: ${isLovable}`);
  return isLovable;
}

serve(async (req) => {
  const requestId = crypto.randomUUID().substring(0, 8);
  const startTime = Date.now();
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 [${requestId}] NOVA REQUISIÇÃO - ${new Date().toISOString()}`);
  console.log(`${'='.repeat(60)}`);
  
  if (req.method === 'OPTIONS') {
    console.log(`🔄 [${requestId}] Requisição OPTIONS (CORS preflight)`);
    return new Response(null, { headers: corsHeaders });
  }

  let requestPayload: any = null;
  
  try {
    // 1. Parse do body
    console.log(`📥 [${requestId}] Parseando body da requisição...`);
    const body = await req.json() as RequestBody;
    requestPayload = { telefone: body.telefone, nome_perfil: body.nome_perfil, tipo_mensagem: body.tipo_mensagem };
    const { telefone, nome_perfil, tipo_mensagem, media_id } = body;
    let { conteudo_texto } = body;
    
    console.log(`📥 [${requestId}] Dados recebidos:`);
    console.log(`   - telefone: ${telefone}`);
    console.log(`   - nome_perfil: ${nome_perfil}`);
    console.log(`   - tipo_mensagem: ${tipo_mensagem || 'text'}`);
    console.log(`   - media_id: ${media_id || 'N/A'}`);
    console.log(`   - conteudo_texto: "${conteudo_texto?.substring(0, 100) || 'vazio'}..."`);

    // 2. Buscar configuração
    console.log(`\n🔧 [${requestId}] ETAPA: Busca de configuração`);
    const config = await getChatbotConfig();
    console.log(`🔧 [${requestId}] Configuração final:`);
    console.log(`   - textModel: ${config.textModel}`);
    console.log(`   - audioModel: ${config.audioModel}`);
    console.log(`   - systemPrompt length: ${config.systemPrompt.length} chars`);

    // 3. Processamento de áudio (se necessário)
    if (tipo_mensagem === 'audio' && media_id) {
      console.log(`\n🎤 [${requestId}] ETAPA: Processamento de áudio`);
      const transcricao = await processarAudio(media_id, config.audioModel);
      conteudo_texto = transcricao ? `[Áudio Transcrito]: ${transcricao}` : "[Erro áudio]";
      console.log(`🎤 [${requestId}] Resultado: ${conteudo_texto.substring(0, 100)}...`);
    }
    const inputTexto = conteudo_texto || "";

    // 4. Buscar/criar sessão
    console.log(`\n💬 [${requestId}] ETAPA: Gerenciamento de sessão`);
    let { data: sessao, error: sessaoError } = await supabase.from('atendimentos_bot')
      .select('*').eq('telefone', telefone).neq('status', 'CONCLUIDO')
      .gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).maybeSingle();

    if (sessaoError) {
      console.log(`⚠️ [${requestId}] Erro ao buscar sessão: ${sessaoError.message}`);
    }

    let historico = sessao ? sessao.historico_conversa : [];
    console.log(`💬 [${requestId}] Sessão existente: ${sessao ? 'SIM' : 'NÃO'}`);
    console.log(`💬 [${requestId}] Histórico: ${historico.length} mensagens`);

    if (!sessao) {
      console.log(`💬 [${requestId}] Criando nova sessão...`);
      const { data: nova, error: novaError } = await supabase.from('atendimentos_bot').insert({ telefone, status: 'INICIADO', historico_conversa: [] }).select().single();
      if (novaError) {
        console.log(`❌ [${requestId}] Erro ao criar sessão: ${novaError.message}`);
      }
      sessao = nova;
      console.log(`✅ [${requestId}] Nova sessão criada: ${sessao?.id}`);
    } else {
      console.log(`✅ [${requestId}] Usando sessão existente: ${sessao.id}`);
    }

    // Log de auditoria - entrada
    await supabase.from('logs_auditoria_chat').insert({ sessao_id: sessao.id, ator: 'USER', payload_raw: { texto: inputTexto } });
    console.log(`📝 [${requestId}] Log de auditoria USER salvo`);

    // 5. Preparar mensagens para IA
    console.log(`\n🤖 [${requestId}] ETAPA: Chamada da IA`);
    const messages = [
      { role: "system", content: config.systemPrompt },
      { role: "system", content: `CONTEXTO USUÁRIO: Telefone: ${telefone}. Nome perfil: ${nome_perfil}.` },
      ...historico.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: inputTexto }
    ];
    console.log(`🤖 [${requestId}] Total de mensagens para IA: ${messages.length}`);

    let aiContent = "";
    const useLovable = isLovableModel(config.textModel);

    if (useLovable) {
      console.log(`🤖 [${requestId}] Usando Lovable AI Gateway`);
      
      if (!LOVABLE_API_KEY) {
        console.log(`❌ [${requestId}] LOVABLE_API_KEY não configurada!`);
        throw new Error('LOVABLE_API_KEY not configured');
      }
      console.log(`🤖 [${requestId}] LOVABLE_API_KEY presente: SIM`);
      
      console.log(`🤖 [${requestId}] Enviando requisição para Lovable AI...`);
      const aiStartTime = Date.now();
      
      const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${LOVABLE_API_KEY}`, 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ model: config.textModel, messages }),
      });

      const aiDuration = Date.now() - aiStartTime;
      console.log(`🤖 [${requestId}] Resposta recebida em ${aiDuration}ms`);
      console.log(`🤖 [${requestId}] Status: ${aiRes.status}`);

      if (!aiRes.ok) {
        const errorText = await aiRes.text();
        console.error(`❌ [${requestId}] Erro Lovable AI: ${aiRes.status}`);
        console.error(`❌ [${requestId}] Detalhes: ${errorText}`);
        throw new Error(`AI request failed: ${aiRes.status}`);
      }

      const aiData = await aiRes.json();
      aiContent = aiData.choices?.[0]?.message?.content || "";
      console.log(`✅ [${requestId}] Resposta IA (${aiContent.length} chars): "${aiContent.substring(0, 150)}..."`);
    } else {
      console.log(`🤖 [${requestId}] Usando OpenAI diretamente`);
      
      if (!OPENAI_API_KEY) {
        console.log(`❌ [${requestId}] OPENAI_API_KEY não configurada!`);
        throw new Error('OPENAI_API_KEY not configured');
      }
      console.log(`🤖 [${requestId}] OPENAI_API_KEY presente: SIM`);

      console.log(`🤖 [${requestId}] Enviando requisição para OpenAI...`);
      const aiStartTime = Date.now();

      const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: config.textModel, messages, temperature: 0.3 }),
      });

      const aiDuration = Date.now() - aiStartTime;
      console.log(`🤖 [${requestId}] Resposta recebida em ${aiDuration}ms`);
      console.log(`🤖 [${requestId}] Status: ${openAIRes.status}`);

      if (!openAIRes.ok) {
        const errorText = await openAIRes.text();
        console.error(`❌ [${requestId}] Erro OpenAI: ${openAIRes.status}`);
        console.error(`❌ [${requestId}] Detalhes: ${errorText}`);
      }

      const aiData = await openAIRes.json();
      aiContent = aiData.choices?.[0]?.message?.content || "";
      console.log(`✅ [${requestId}] Resposta IA (${aiContent.length} chars): "${aiContent.substring(0, 150)}..."`);
    }

    // 6. Parse de JSON da resposta
    console.log(`\n📦 [${requestId}] ETAPA: Parse de resposta`);
    let parsedJson: ChatResponse | null = null;
    try {
      const clean = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
      if (clean.startsWith('{')) {
        parsedJson = JSON.parse(clean);
        console.log(`📦 [${requestId}] JSON parseado com sucesso:`);
        console.log(`   - concluido: ${parsedJson?.concluido}`);
        console.log(`   - intencao: ${parsedJson?.intencao}`);
        console.log(`   - nome_final: ${parsedJson?.nome_final}`);
        console.log(`   - notificar_admin: ${parsedJson?.notificar_admin}`);
      } else {
        console.log(`📦 [${requestId}] Resposta não é JSON (conversa em andamento)`);
      }
    } catch (e) {
      console.log(`📦 [${requestId}] Resposta não contém JSON válido (esperado)`);
    }

    let responseMessage = aiContent;
    // Inicializa com o valor do JSON da IA (se presente)
    let notificarAdmin = parsedJson?.notificar_admin || false;

    // 7. Execução da lógica de negócio
    console.log(`\n⚙️ [${requestId}] ETAPA: Execução de lógica`);
    
    if (parsedJson?.concluido) {
      console.log(`⚙️ [${requestId}] Conversa CONCLUÍDA - processando intenção: ${parsedJson.intencao}`);
      
      await supabase.from('atendimentos_bot').update({
        status: 'CONCLUIDO',
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);
      console.log(`⚙️ [${requestId}] Sessão marcada como CONCLUIDA`);

      const { data: profile } = await supabase.from('profiles').select('id').eq('telefone', telefone).maybeSingle();
      let visitanteId = null;
      let origem = 'WABA_INTERNO';

      if (!profile) {
        origem = 'WABA_EXTERNO';
        console.log(`⚙️ [${requestId}] Usuário não encontrado em profiles, criando lead...`);
        visitanteId = await getOrCreateLead(telefone, parsedJson.nome_final || nome_perfil);
      } else {
        console.log(`⚙️ [${requestId}] Usuário encontrado em profiles: ${profile.id}`);
      }

      if (parsedJson.intencao === 'PEDIDO_ORACAO') {
        console.log(`🙏 [${requestId}] Processando PEDIDO_ORACAO...`);
        const { error: insertError } = await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: parsedJson.motivo_resumo,
          texto_na_integra: parsedJson.texto_na_integra,
          analise_ia_motivo: parsedJson.categoria,
          anonimo: parsedJson.anonimo || false,
          origem, membro_id: profile?.id, visitante_id: visitanteId
        });
        if (insertError) {
          console.log(`❌ [${requestId}] Erro ao inserir pedido: ${insertError.message}`);
        } else {
          console.log(`✅ [${requestId}] Pedido de oração salvo`);
        }
        responseMessage = parsedJson.anonimo 
          ? "Seu pedido foi anotado em sigilo (ANÔNIMO). Estaremos orando. 🙏"
          : `Anotado, ${parsedJson.nome_final}! Já enviei para a equipe de oração. 🙏`;
      }
      else if (parsedJson.intencao === 'SOLICITACAO_PASTORAL') {
        console.log(`⛪ [${requestId}] Processando SOLICITACAO_PASTORAL...`);
        const { error: insertError } = await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: `ATENDIMENTO PASTORAL: ${parsedJson.motivo_resumo}`,
          texto_na_integra: `[SOLICITAÇÃO DE PASTOR] ${parsedJson.texto_na_integra}`,
          analise_ia_motivo: 'GABINETE_PASTORAL', analise_ia_gravidade: 'ALTA',
          origem, membro_id: profile?.id, visitante_id: visitanteId
        });
        if (insertError) {
          console.log(`❌ [${requestId}] Erro ao inserir solicitação: ${insertError.message}`);
        } else {
          console.log(`✅ [${requestId}] Solicitação pastoral salva`);
        }
        // Força notificar_admin=true para SOLICITACAO_PASTORAL (fallback se IA não enviar)
        notificarAdmin = parsedJson?.notificar_admin ?? true;
        console.log(`⚙️ [${requestId}] notificar_admin definido: ${notificarAdmin}`);
        responseMessage = `Entendido. Já notifiquei o pastor sobre: "${parsedJson.motivo_resumo}".`;
      }
      else if (parsedJson.intencao === 'TESTEMUNHO') {
        console.log(`🎉 [${requestId}] Processando TESTEMUNHO...`);
        const { error: insertError } = await supabase.from('testemunhos').insert({
          titulo: parsedJson.motivo_resumo, mensagem: parsedJson.texto_na_integra, publicar: parsedJson.publicar || false,
          origem, autor_id: profile?.id, visitante_id: visitanteId
        });
        if (insertError) {
          console.log(`❌ [${requestId}] Erro ao inserir testemunho: ${insertError.message}`);
        } else {
          console.log(`✅ [${requestId}] Testemunho salvo`);
        }
        responseMessage = parsedJson.publicar
          ? "Glória a Deus! 🙌 Vamos compartilhar sua vitória com a igreja."
          : "Amém! Seu relato foi salvo para a liderança.";
      }

    } else {
      console.log(`⚙️ [${requestId}] Conversa em andamento - atualizando histórico`);
      await supabase.from('atendimentos_bot').update({
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);
    }

    // 8. Log de auditoria - saída
    await supabase.from('logs_auditoria_chat').insert({ sessao_id: sessao.id, ator: 'BOT', payload_raw: { resposta: responseMessage, json: parsedJson } });
    console.log(`📝 [${requestId}] Log de auditoria BOT salvo`);

    // 9. Resposta final
    const finalResponse = { 
      reply_message: responseMessage,
      notificar_admin: notificarAdmin,
      dados_contato: { telefone, nome: parsedJson?.nome_final || nome_perfil, motivo: parsedJson?.motivo_resumo }
    };
    
    console.log(`\n✅ [${requestId}] RESPOSTA FINAL:`);
    console.log(`   - reply_message: "${responseMessage.substring(0, 100)}..."`);
    console.log(`   - notificar_admin: ${notificarAdmin}`);
    console.log(`${'='.repeat(60)}\n`);

    // 10. Registrar métricas de execução
    const executionTime = Date.now() - startTime;
    console.log(`📊 [${requestId}] Tempo de execução: ${executionTime}ms`);
    
    await supabase.rpc('log_edge_function_with_metrics', {
      p_function_name: FUNCTION_NAME,
      p_status: 'success',
      p_execution_time_ms: executionTime,
      p_request_payload: requestPayload,
      p_response_payload: { reply_message: responseMessage?.substring(0, 200), notificar_admin: notificarAdmin }
    });

    return new Response(JSON.stringify(finalResponse), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });

  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error(`\n❌ [${requestId}] ERRO FATAL:`);
    console.error(error);
    console.log(`${'='.repeat(60)}\n`);
    
    // Registrar erro nas métricas
    await supabase.rpc('log_edge_function_with_metrics', {
      p_function_name: FUNCTION_NAME,
      p_status: 'error',
      p_execution_time_ms: executionTime,
      p_error_message: error instanceof Error ? error.message : 'Unknown error',
      p_request_payload: requestPayload
    });
    
    return new Response(JSON.stringify({ error: 'Erro interno', details: error instanceof Error ? error.message : 'Unknown' }), { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});
