import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.49.1";

// --- INTERFACES ---
interface RequestBody {
  telefone: string;
  nome_perfil: string;
  tipo_mensagem?: "text" | "audio" | "image";
  conteudo_texto?: string;
  mensagem?: string;
  text?: string;
  message?: string;
  messages?: Array<{ text?: { body?: string } }>;
  whatsapp_number?: string;
  display_phone_number?: string;
  phone_number_id?: string;
  igreja_id?: string;
  filial_id?: string;
  media_id?: string;
}

interface ChatbotConfig {
  textModel: string;
  audioModel: string;
  systemPrompt: string;
}

interface SessionMeta {
  flow?: "inscricao" | "oracao" | "testemunho" | "pastoral" | null;
  step?: string;
  evento_id?: string;
  evento_titulo?: string;
  nome_confirmado?: string;
  eventos_disponiveis?: Array<{ id: string; titulo: string }>;
  phone_number_id?: string | null;
  display_phone_number?: string | null;
}

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
  vagas_limite?: number | null;
  requer_pagamento?: boolean | null;
  inscricoes_abertas_ate?: string | null;
}

// --- CONFIGURAÇÃO ---
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const WHATSAPP_API_TOKEN = Deno.env.get("WHATSAPP_API_TOKEN");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = Deno.env.get("APP_URL") || "https://igreja.lovable.app";

const FUNCTION_NAME = "chatbot-triagem";
const UUID_PASTOR_PLANTAO: string | null = "a4097879-f52a-4bf2-86e6-62ad02a06268";
const TELEFONE_PASTOR_PLANTAO = "5517988216456";

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const DEFAULT_SYSTEM_PROMPT = `
Você é da Equipe de Acolhimento da Igreja Carvalho.
REGRAS: 1. Nunca diga que é IA. 2. Use a FAQ. 
FLUXOS: 
- ORAÇÃO: Colete dados -> JSON (intencao: PEDIDO_ORACAO).
- PASTOR: Pergunte motivo -> JSON (intencao: SOLICITACAO_PASTORAL).
- TESTEMUNHO: Colete relato -> JSON (intencao: TESTEMUNHO).
- INSCRIÇÃO: Detecte interesse em eventos/compartilhe -> JSON (intencao: INSCRICAO_EVENTO).
FAQ: Cultos Dom 18h30/Qui 19h30. End: Av. Gabriel Jorge Cury 232.

JSON FINAL:
\`\`\`json
{
  "concluido": true,
  "intencao": "PEDIDO_ORACAO" | "TESTEMUNHO" | "SOLICITACAO_PASTORAL" | "INSCRICAO_EVENTO",
  "nome_final": "...",
  "motivo_resumo": "...",
  "texto_na_integra": "...",
  "categoria": "SAUDE|FAMILIA|FINANCEIRO|ESPIRITUAL|GABINETE|INSCRICAO|OUTROS",
  "anonimo": false,
  "publicar": false,
  "notificar_admin": false
}
\`\`\`
`;

const DEFAULT_TEXT_MODEL = "gpt-4o-mini";
const DEFAULT_AUDIO_MODEL = "whisper-1";

// --- FUNÇÕES AUXILIARES DETERMINÍSTICAS (SEM IA) ---

const isAfirmativo = (text: string): boolean =>
  /^(sim|s|ok|isso|confirmo|confirmar|pode|certo|correto|confirma|isso\s*mesmo|yes|ss)$/i.test(text.trim());

const isNegativo = (text: string): boolean =>
  /^(nao|não|n|errado|corrigir|cancelar|cancela|mudar|incorreto|no)$/i.test(text.trim());

const normalizePhone = (telefone: string): string => {
  const digits = telefone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length > 11) {
    return digits.slice(2);
  }
  return digits;
};

const normalizeDisplayPhone = (tel?: string | null): string =>
  (tel || "").replace(/\D/g, "");

// Fuzzy match de evento pelo texto do usuário
function inferirEvento(
  eventos: Array<{ id: string; titulo: string }>,
  textoUsuario: string
): { id: string; titulo: string } | null {
  const textoNorm = textoUsuario.toLowerCase().trim();

  const eventoExato = eventos.find((e) => {
    const titulo = e.titulo.toLowerCase();
    return (
      textoNorm.includes(titulo) ||
      (titulo.includes("compartilhe") && textoNorm.includes("compartilhe"))
    );
  });

  return eventoExato || null;
}

// Detectar intenção de inscrição por palavras-chave (SEM IA)
function detectarIntencaoInscricao(texto: string): boolean {
  const textoNorm = texto.toLowerCase().trim();
  const keywords = [
    "compartilhe",
    "inscricao",
    "inscrição",
    "inscrever",
    "quero participar",
    "quero me inscrever",
    "participar do evento",
    "workshop",
    "conferencia",
    "conferência",
  ];
  return keywords.some((kw) => textoNorm.includes(kw));
}

// Buscar eventos abertos para inscrição
async function buscarEventosAbertos(
  supabaseClient: SupabaseClient,
  igrejaId: string,
  filialId: string | null
): Promise<Evento[]> {
  const agora = new Date().toISOString();

  let query = supabaseClient
    .from("eventos")
    .select("id, titulo, data_evento, vagas_limite, requer_pagamento, inscricoes_abertas_ate")
    .eq("igreja_id", igrejaId)
    .eq("status", "confirmado")
    .eq("requer_inscricao", true)
    .gte("data_evento", agora)
    .order("data_evento", { ascending: true })
    .limit(10);

  if (filialId) {
    query = query.eq("filial_id", filialId);
  }

  const { data: eventos } = await query;

  // Filtrar eventos com inscrições ainda abertas
  return (eventos || []).filter(
    (e) => !e.inscricoes_abertas_ate || e.inscricoes_abertas_ate >= agora
  );
}

// Atualizar meta_dados da sessão
async function atualizarMetaSessao(
  supabaseClient: SupabaseClient,
  sessaoId: string,
  novaMeta: SessionMeta
): Promise<void> {
  await supabaseClient
    .from("atendimentos_bot")
    .update({ 
      meta_dados: novaMeta, 
      updated_at: new Date().toISOString() 
    })
    .eq("id", sessaoId);
}

// Resposta JSON padronizada
function respostaJson(message: string, extras: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ reply_message: message, ...extras }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

// --- CONFIGURAÇÃO (DB) ---
async function getChatbotConfig(): Promise<ChatbotConfig> {
  try {
    const { data: config } = await supabase
      .from("chatbot_configs")
      .select("modelo_texto, modelo_audio, role_texto")
      .eq("edge_function_name", FUNCTION_NAME)
      .eq("ativo", true)
      .maybeSingle();

    if (!config) {
      return {
        textModel: DEFAULT_TEXT_MODEL,
        audioModel: DEFAULT_AUDIO_MODEL,
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
      };
    }
    return {
      textModel: config.modelo_texto || DEFAULT_TEXT_MODEL,
      audioModel: config.modelo_audio || DEFAULT_AUDIO_MODEL,
      systemPrompt: config.role_texto || DEFAULT_SYSTEM_PROMPT,
    };
  } catch {
    return {
      textModel: DEFAULT_TEXT_MODEL,
      audioModel: DEFAULT_AUDIO_MODEL,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
    };
  }
}

// --- LIMPEZA DE JSON ---
function extractJsonAndText(aiContent: string): {
  cleanText: string;
  parsedJson: Record<string, unknown> | null;
} {
  let cleanText = aiContent;
  let parsedJson: Record<string, unknown> | null = null;

  try {
    const markdownMatch = aiContent.match(/```(?:json)?([\s\S]*?)```/i);
    if (markdownMatch && markdownMatch[1]) {
      try {
        parsedJson = JSON.parse(markdownMatch[1].trim());
        cleanText = aiContent.replace(markdownMatch[0], "").trim();
      } catch {
        // Falha no parse do JSON markdown
      }
    }

    if (!parsedJson) {
      const firstOpen = aiContent.indexOf("{");
      const lastClose = aiContent.lastIndexOf("}");
      if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
        try {
          const tempJson = JSON.parse(aiContent.substring(firstOpen, lastClose + 1));
          // Aceita JSON com concluido OU fluxo_atual OU intencao
          const isUsefulMeta =
            typeof tempJson === "object" &&
            tempJson !== null &&
            (tempJson.concluido === true ||
              typeof tempJson.fluxo_atual === "string" ||
              typeof tempJson.intencao === "string");

          if (isUsefulMeta) {
            parsedJson = tempJson;
            cleanText = aiContent.substring(0, firstOpen).trim();
          }
        } catch {
          // JSON inline inválido
        }
      }
    }
  } catch {
    // Erro geral no processamento
  }

  cleanText = (cleanText || aiContent)
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  return { cleanText, parsedJson };
}

// --- ROTEAMENTO DE PASTOR ---
async function definirPastorResponsavel(
  perfilUsuario: Record<string, unknown>
): Promise<string | null> {
  if (perfilUsuario?.lider_id) {
    return perfilUsuario.lider_id as string;
  }
  return UUID_PASTOR_PLANTAO;
}

// --- ÁUDIO ---
async function processarAudio(
  mediaId: string,
  audioModel: string
): Promise<string | null> {
  try {
    if (!WHATSAPP_API_TOKEN || !OPENAI_API_KEY) return null;
    const urlRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, {
      headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}` },
    });
    const mediaData = await urlRes.json();
    if (!mediaData.url) return null;
    const audioRes = await fetch(mediaData.url, {
      headers: { Authorization: `Bearer ${WHATSAPP_API_TOKEN}` },
    });
    const blob = await audioRes.blob();
    const formData = new FormData();
    formData.append("file", blob, "audio.ogg");
    formData.append("model", audioModel);
    const openAiRes = await fetch(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
        body: formData,
      }
    );
    const data = await openAiRes.json();
    return data.text;
  } catch {
    return null;
  }
}

// --- FLUXO DE INSCRIÇÃO INTEGRADO ---

async function finalizarInscricao(
  sessao: Record<string, unknown>,
  meta: SessionMeta,
  supabaseClient: SupabaseClient,
  igrejaId: string,
  filialId: string | null
): Promise<Response> {
  const telefone = sessao.telefone as string;
  const nomeFinal = meta.nome_confirmado || "Visitante";
  const eventoId = meta.evento_id;
  
  if (!eventoId) {
    return respostaJson("Erro: evento não identificado. Por favor, inicie novamente.");
  }

  console.log(`[Inscricao] Finalizando inscrição: evento=${eventoId}, nome=${nomeFinal}, tel=${telefone}`);

  // Buscar evento para validar
  const { data: evento } = await supabaseClient
    .from("eventos")
    .select("id, titulo, requer_pagamento, vagas_limite, inscricoes_abertas_ate, igreja_id")
    .eq("id", eventoId)
    .single();

  if (!evento) {
    await supabaseClient.from("atendimentos_bot").update({ status: "CONCLUIDO" }).eq("id", sessao.id);
    return respostaJson("Este evento não está mais disponível.");
  }

  // Verificar vagas
  if (evento.vagas_limite) {
    const { count } = await supabaseClient
      .from("inscricoes_eventos")
      .select("id", { count: "exact", head: true })
      .eq("evento_id", evento.id)
      .eq("igreja_id", igrejaId)
      .neq("status_pagamento", "cancelado");

    if ((count || 0) >= evento.vagas_limite) {
      await supabaseClient.from("atendimentos_bot").update({ status: "CONCLUIDO" }).eq("id", sessao.id);
      return respostaJson("As vagas para este evento estão esgotadas. 😢");
    }
  }

  // Buscar ou criar pessoa
  const telefoneNormalizado = normalizePhone(telefone);
  const telefoneBusca = telefoneNormalizado.slice(-9);
  
  const { data: candidatos } = await supabaseClient
    .from("profiles")
    .select("id, telefone")
    .eq("igreja_id", igrejaId)
    .ilike("telefone", `%${telefoneBusca}%`)
    .limit(5);

  let pessoaId: string | null = null;
  if (candidatos && candidatos.length > 0) {
    const alvo = candidatos.find((p) => normalizePhone(p.telefone || "") === telefoneNormalizado);
    pessoaId = alvo?.id ?? candidatos[0].id ?? null;
  }

  if (!pessoaId) {
    const { data: novaPessoa, error } = await supabaseClient
      .from("profiles")
      .insert({
        nome: nomeFinal,
        telefone: telefoneNormalizado,
        status: "visitante",
        igreja_id: igrejaId,
        filial_id: filialId,
      })
      .select("id")
      .single();

    if (error || !novaPessoa) {
      console.error("[Inscricao] Erro ao criar perfil:", error);
      return respostaJson("Erro ao registrar seus dados. Tente novamente.");
    }
    pessoaId = novaPessoa.id;
  }

  // Verificar inscrição existente
  const { data: inscricaoExistente } = await supabaseClient
    .from("inscricoes_eventos")
    .select("id, qr_token, status_pagamento")
    .eq("evento_id", evento.id)
    .eq("pessoa_id", pessoaId)
    .eq("igreja_id", igrejaId)
    .maybeSingle();

  if (inscricaoExistente && inscricaoExistente.status_pagamento !== "cancelado") {
    const qrLink = `${APP_URL}/eventos/checkin/${inscricaoExistente.qr_token}`;
    await supabaseClient.from("atendimentos_bot").update({ status: "CONCLUIDO" }).eq("id", sessao.id);
    return respostaJson(`Você já está inscrito! 🎉\n\nAcesse seu QR Code:\n${qrLink}`, { qr_url: qrLink });
  }

  // Reativar inscrição cancelada
  if (inscricaoExistente && inscricaoExistente.status_pagamento === "cancelado") {
    const statusPagamento = evento.requer_pagamento ? "pendente" : "isento";
    await supabaseClient
      .from("inscricoes_eventos")
      .update({ status_pagamento: statusPagamento, cancelado_em: null })
      .eq("id", inscricaoExistente.id);

    const qrLink = `${APP_URL}/eventos/checkin/${inscricaoExistente.qr_token}`;
    await supabaseClient.from("atendimentos_bot").update({ status: "CONCLUIDO" }).eq("id", sessao.id);
    
    const msg = evento.requer_pagamento
      ? `Inscrição reativada! Sua vaga está reservada por 24h.\n\nQR Code: ${qrLink}`
      : `Inscrição confirmada! 🎉\n\nQR Code: ${qrLink}`;
    return respostaJson(msg, { qr_url: qrLink });
  }

  // Criar nova inscrição
  const statusPagamento = evento.requer_pagamento ? "pendente" : "isento";
  const { data: novaInscricao, error: inscricaoError } = await supabaseClient
    .from("inscricoes_eventos")
    .insert({
      evento_id: evento.id,
      pessoa_id: pessoaId,
      status_pagamento: statusPagamento,
      responsavel_inscricao_id: pessoaId,
      igreja_id: igrejaId,
      filial_id: filialId,
    })
    .select("id, qr_token")
    .single();

  if (inscricaoError || !novaInscricao) {
    console.error("[Inscricao] Erro ao criar inscrição:", inscricaoError);
    return respostaJson("Erro ao criar inscrição. Tente novamente.");
  }

  const qrLink = `${APP_URL}/eventos/checkin/${novaInscricao.qr_token}`;
  await supabaseClient.from("atendimentos_bot").update({ status: "CONCLUIDO" }).eq("id", sessao.id);

  const mensagemFinal = evento.requer_pagamento
    ? `Inscrição registrada! 🎉\n\nSua vaga está reservada por 24h.\n\nQR Code: ${qrLink}`
    : `Inscrição confirmada! 🎉\n\nAqui está seu QR Code:\n${qrLink}`;

  console.log(`[Inscricao] Sucesso! Inscrição ${novaInscricao.id} criada.`);
  return respostaJson(mensagemFinal, { qr_url: qrLink });
}

async function handleFluxoInscricao(
  sessao: Record<string, unknown>,
  meta: SessionMeta,
  texto: string,
  supabaseClient: SupabaseClient,
  igrejaId: string,
  filialId: string | null,
  nomePerfil: string
): Promise<Response> {
  const step = meta.step || "inicial";
  const textoNorm = texto.toLowerCase().trim();

  console.log(`[Inscricao] handleFluxoInscricao - step: ${step}, texto: "${textoNorm}"`);

  // STEP: Usuário escolhendo de uma lista de eventos
  if (step === "selecionando_evento" && meta.eventos_disponiveis) {
    const escolha = parseInt(textoNorm);
    if (!isNaN(escolha) && escolha >= 1 && escolha <= meta.eventos_disponiveis.length) {
      const eventoEscolhido = meta.eventos_disponiveis[escolha - 1];
      await atualizarMetaSessao(supabaseClient, sessao.id as string, {
        ...meta,
        step: "confirmando_dados",
        evento_id: eventoEscolhido.id,
        evento_titulo: eventoEscolhido.titulo,
        nome_confirmado: nomePerfil,
      });

      return respostaJson(
        `Evento: *${eventoEscolhido.titulo}*\n\nSeus dados:\nNome: ${nomePerfil}\nTelefone: ${sessao.telefone}\n\nEstá correto? Responda *SIM* ou *NÃO*.`
      );
    }
    return respostaJson(
      `Por favor, digite o número do evento (1 a ${meta.eventos_disponiveis.length}).`
    );
  }

  // STEP: Confirmação de dados (SEM IA!)
  if (step === "confirmando_dados") {
    if (isAfirmativo(textoNorm)) {
      console.log(`[Inscricao] Resposta afirmativa detectada, finalizando...`);
      return await finalizarInscricao(sessao, meta, supabaseClient, igrejaId, filialId);
    }
    if (isNegativo(textoNorm)) {
      console.log(`[Inscricao] Resposta negativa detectada, solicitando correção...`);
      await atualizarMetaSessao(supabaseClient, sessao.id as string, { ...meta, step: "correcao" });
      return respostaJson("Qual o nome correto para a inscrição?");
    }
    // Resposta ambígua - repetir pergunta
    console.log(`[Inscricao] Resposta ambígua: "${textoNorm}"`);
    return respostaJson(
      `Nome: ${meta.nome_confirmado || nomePerfil}\nTelefone: ${sessao.telefone}\n\nEstá correto? Responda *SIM* ou *NÃO*.`
    );
  }

  // STEP: Correção de dados
  if (step === "correcao") {
    const nomeCorrigido = texto.trim();
    if (nomeCorrigido.length < 2) {
      return respostaJson("Por favor, envie o nome correto.");
    }
    await atualizarMetaSessao(supabaseClient, sessao.id as string, {
      ...meta,
      step: "confirmando_dados",
      nome_confirmado: nomeCorrigido,
    });
    return respostaJson(
      `Nome: ${nomeCorrigido}\nTelefone: ${sessao.telefone}\n\nEstá correto? Responda *SIM* ou *NÃO*.`
    );
  }

  // Fallback: reiniciar fluxo de inscrição
  return await iniciarFluxoInscricao(sessao, texto, supabaseClient, igrejaId, filialId, nomePerfil);
}

async function iniciarFluxoInscricao(
  sessao: Record<string, unknown>,
  texto: string,
  supabaseClient: SupabaseClient,
  igrejaId: string,
  filialId: string | null,
  nomePerfil: string
): Promise<Response> {
  console.log(`[Inscricao] iniciarFluxoInscricao - igreja=${igrejaId}, filial=${filialId}`);

  const eventos = await buscarEventosAbertos(supabaseClient, igrejaId, filialId);
  console.log(`[Inscricao] Eventos encontrados: ${eventos.length}`);

  // CENÁRIO 1: Sem eventos
  if (eventos.length === 0) {
    await supabaseClient
      .from("atendimentos_bot")
      .update({ status: "CONCLUIDO" })
      .eq("id", sessao.id);
    return respostaJson(
      "No momento não temos eventos com inscrições abertas, mas agradecemos muito seu contato! 🙏"
    );
  }

  // CENÁRIO 2: Tentar inferir evento pelo texto
  const eventoInferido = inferirEvento(eventos, texto);

  if (eventoInferido || eventos.length === 1) {
    const evento = eventoInferido || eventos[0];
    console.log(`[Inscricao] Evento identificado: ${evento.titulo} (${evento.id})`);

    await atualizarMetaSessao(supabaseClient, sessao.id as string, {
      flow: "inscricao",
      step: "confirmando_dados",
      evento_id: evento.id,
      evento_titulo: evento.titulo,
      nome_confirmado: nomePerfil,
      phone_number_id: (sessao.meta_dados as SessionMeta)?.phone_number_id,
      display_phone_number: (sessao.meta_dados as SessionMeta)?.display_phone_number,
    });

    return respostaJson(
      `Encontrei o evento *${evento.titulo}*! 🎉\n\nSeus dados:\nNome: ${nomePerfil}\nTelefone: ${sessao.telefone}\n\nEstá correto? Responda *SIM* ou *NÃO*.`
    );
  }

  // CENÁRIO 3: Múltiplos eventos, listar para escolha
  const lista = eventos
    .slice(0, 5)
    .map((e, i) => `${i + 1}. ${e.titulo}`)
    .join("\n");

  await atualizarMetaSessao(supabaseClient, sessao.id as string, {
    flow: "inscricao",
    step: "selecionando_evento",
    eventos_disponiveis: eventos.slice(0, 5).map((e) => ({ id: e.id, titulo: e.titulo })),
    nome_confirmado: nomePerfil,
    phone_number_id: (sessao.meta_dados as SessionMeta)?.phone_number_id,
    display_phone_number: (sessao.meta_dados as SessionMeta)?.display_phone_number,
  });

  return respostaJson(
    `Temos ${eventos.length} eventos com inscrições abertas:\n\n${lista}\n\nDigite o *número* do evento desejado.`
  );
}

// --- SERVIDOR PRINCIPAL ---
serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  let requestPayload: RequestBody = {} as RequestBody;

  try {
    const body = (await req.json()) as RequestBody;
    requestPayload = body;

    console.log(`[Triagem] Payload recebido - campos: ${Object.keys(body).join(", ")}`);

    const { telefone, nome_perfil, tipo_mensagem, media_id } = body;

    // Fallback para múltiplos nomes de campo de mensagem
    let conteudo_texto =
      body.mensagem ??
      body.conteudo_texto ??
      body.text ??
      body.message ??
      body.messages?.[0]?.text?.body ??
      "";

    console.log(`[Triagem] Texto extraído: "${(conteudo_texto || "").slice(0, 100)}"`);

    // Identificar igreja/filial pelo whatsapp_number
    const whatsappNumber = body.whatsapp_number ?? body.display_phone_number ?? null;
    const phoneNumberId = body.phone_number_id ?? null;
    const whatsappNumeroNormalizado = normalizeDisplayPhone(whatsappNumber);

    let igrejaId = body.igreja_id ?? null;
    let filialId = body.filial_id ?? null;

    if (!igrejaId && whatsappNumeroNormalizado) {
      console.log(`[Triagem] Buscando igreja pelo whatsapp_number: ${whatsappNumeroNormalizado}`);

      const { data: rota } = await supabase
        .from("whatsapp_numeros")
        .select("igreja_id, filial_id")
        .eq("display_phone_number", whatsappNumeroNormalizado)
        .eq("enabled", true)
        .maybeSingle();

      if (rota) {
        igrejaId = rota.igreja_id;
        filialId = rota.filial_id;
        console.log(`[Triagem] Igreja encontrada: ${igrejaId}, filial: ${filialId}`);
      }
    }

    // Configuração
    const config = await getChatbotConfig();

    // Processamento de Áudio
    if (tipo_mensagem === "audio" && media_id) {
      const transcricao = await processarAudio(media_id, config.audioModel);
      conteudo_texto = transcricao ? `[Áudio Transcrito]: ${transcricao}` : "[Erro áudio]";
    }
    const inputTexto = conteudo_texto || "";

    // ========== GESTÃO DE SESSÃO ==========
    let sessaoQuery = supabase
      .from("atendimentos_bot")
      .select("*")
      .eq("telefone", telefone)
      .neq("status", "CONCLUIDO")
      .gt("updated_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (igrejaId) {
      sessaoQuery = sessaoQuery.eq("igreja_id", igrejaId);
    }

    if (phoneNumberId) {
      sessaoQuery = sessaoQuery.contains("meta_dados", { phone_number_id: phoneNumberId });
    }

    let { data: sessao } = await sessaoQuery.maybeSingle();

    // TIMEOUT AUTOMÁTICO: Se sessão tem mais de 24h, finaliza
    if (sessao) {
      const updatedAt = new Date(sessao.updated_at);
      const now = new Date();
      const diffHours = (now.getTime() - updatedAt.getTime()) / (1000 * 60 * 60);

      if (diffHours >= 24) {
        console.log(`[Triagem] Sessão ${sessao.id} expirou (${diffHours.toFixed(1)}h). Finalizando...`);
        await supabase.from("atendimentos_bot").update({ status: "TIMEOUT_24H" }).eq("id", sessao.id);
        sessao = null;
      }
    }

    const historico = sessao ? sessao.historico_conversa : [];

    if (!sessao) {
      const { data: nova, error } = await supabase
        .from("atendimentos_bot")
        .insert({
          telefone,
          status: "INICIADO",
          historico_conversa: [],
          igreja_id: igrejaId,
          filial_id: filialId,
          meta_dados: {
            phone_number_id: phoneNumberId ?? null,
            display_phone_number: whatsappNumeroNormalizado || null,
          },
        })
        .select()
        .single();

      if (error || !nova) {
        throw new Error("Erro ao criar sessão no banco de dados.");
      }
      sessao = nova;
    }

    // Log de Entrada
    await supabase.from("logs_auditoria_chat").insert({
      sessao_id: sessao.id,
      ator: "USER",
      payload_raw: { texto: inputTexto },
    });

    // ========== NOVO: VERIFICAR FLOW EXISTENTE NA SESSÃO ==========
    const meta = (sessao.meta_dados || {}) as SessionMeta;

    if (meta.flow) {
      console.log(`[Triagem] Sessão com flow ativo: ${meta.flow}, step: ${meta.step}`);

      // HANDLER DIRETO - sem chamar IA para reclassificar
      switch (meta.flow) {
        case "inscricao":
          return await handleFluxoInscricao(
            sessao,
            meta,
            inputTexto,
            supabase,
            igrejaId!,
            filialId,
            nome_perfil
          );

        case "oracao":
        case "testemunho":
        case "pastoral":
          // Para outros flows, continua com IA mas NÃO reclassifica
          console.log(`[Triagem] Flow ${meta.flow} - continuando coleta com IA`);
          break;
      }
    }

    // ========== DETECÇÃO DETERMINÍSTICA DE INSCRIÇÃO ==========
    // SÓ detecta keyword se NÃO houver flow ativo na sessão
    if (!meta.flow && detectarIntencaoInscricao(inputTexto)) {
      console.log(`[Triagem] Detectada intenção de inscrição por palavra-chave. Iniciando fluxo direto...`);
      return await iniciarFluxoInscricao(
        sessao,
        inputTexto,
        supabase,
        igrejaId!,
        filialId,
        nome_perfil
      );
    }

    // ========== SEM FLOW E SEM KEYWORD: CLASSIFICAR COM IA ==========
    console.log(`[Triagem] Sem flow ativo e sem keyword de inscrição, chamando IA para classificação...`);

    const messages = [
      { role: "system", content: config.systemPrompt },
      { role: "system", content: `CTX: Tel ${telefone}, Nome ${nome_perfil}.` },
      ...historico.map((h: Record<string, unknown>) => ({
        role: h.role,
        content: h.content,
      })),
      { role: "user", content: inputTexto },
    ];

    let aiContent = "";

    if (config.textModel.startsWith("google/") && LOVABLE_API_KEY) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: config.textModel, messages }),
      });
      const data = await res.json();
      aiContent = data.choices?.[0]?.message?.content || "";
    } else {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: config.textModel,
          messages,
          temperature: 0.3,
        }),
      });
      const data = await res.json();
      aiContent = data.choices?.[0]?.message?.content || "";
    }

    // Limpeza e Extração
    const { cleanText, parsedJson } = extractJsonAndText(aiContent);
    let responseMessage = cleanText;
    let notificarAdmin = false;

    // ========== LÓGICA DE NEGÓCIO ==========
    if (parsedJson?.concluido) {
      console.log(`[Triagem] IA retornou JSON concluído. Intenção: ${parsedJson.intencao}`);

      // CASO ESPECIAL: INSCRIÇÃO EM EVENTO - USAR FLUXO INTEGRADO
      if (parsedJson.intencao === "INSCRICAO_EVENTO") {
        console.log(`[Triagem] Iniciando fluxo de inscrição integrado...`);
        return await iniciarFluxoInscricao(
          sessao,
          inputTexto,
          supabase,
          igrejaId!,
          filialId,
          nome_perfil
        );
      }

      // Fecha Sessão para outros casos
      await supabase
        .from("atendimentos_bot")
        .update({
          status: "CONCLUIDO",
          historico_conversa: [
            ...historico,
            { role: "user", content: inputTexto },
            { role: "assistant", content: aiContent },
          ],
        })
        .eq("id", sessao.id);

      // GESTÃO DE IDENTIDADE
      const { data: perfis } = await supabase
        .from("profiles")
        .select("id, nome, lider_id, data_nascimento, created_at")
        .eq("telefone", telefone)
        .limit(5);

      let profile: Record<string, unknown> | null = null;

      if (perfis && perfis.length > 0) {
        if (perfis.length > 1) {
          console.warn(`Telefone ${telefone} vinculado a múltiplos perfis`);
          perfis.sort((a, b) => {
            const dataA = a.data_nascimento ? new Date(a.data_nascimento).getTime() : Infinity;
            const dataB = b.data_nascimento ? new Date(b.data_nascimento).getTime() : Infinity;
            if (dataA !== dataB) return dataA - dataB;
            const createdA = a.created_at ? new Date(a.created_at).getTime() : Infinity;
            const createdB = b.created_at ? new Date(b.created_at).getTime() : Infinity;
            return createdA - createdB;
          });
        }
        profile = perfis[0];
      }

      let visitanteId = null;
      let origem = "WABA_INTERNO";
      let pastorResponsavelId = null;

      if (!profile) {
        origem = "WABA_EXTERNO";
        const { data: lead } = await supabase
          .from("visitantes_leads")
          .select("id")
          .eq("telefone", telefone)
          .maybeSingle();

        if (lead) {
          visitanteId = lead.id;
        } else {
          const { data: newLead } = await supabase
            .from("visitantes_leads")
            .insert({
              telefone,
              nome: (parsedJson.nome_final as string) || nome_perfil,
              origem: "BOT",
            })
            .select("id")
            .single();
          visitanteId = newLead?.id;
        }
        pastorResponsavelId = UUID_PASTOR_PLANTAO;
      } else {
        pastorResponsavelId = await definirPastorResponsavel(profile);
      }

      // GRAVAÇÃO POR INTENÇÃO
      if (parsedJson.intencao === "PEDIDO_ORACAO") {
        await supabase.from("pedidos_oracao").insert({
          analise_ia_titulo: parsedJson.motivo_resumo,
          texto_na_integra: parsedJson.texto_na_integra,
          analise_ia_motivo: parsedJson.categoria,
          anonimo: parsedJson.anonimo || false,
          origem,
          membro_id: profile?.id,
          visitante_id: visitanteId,
        });

        if (!parsedJson.anonimo) {
          await supabase.from("atendimentos_pastorais").insert({
            pessoa_id: profile?.id,
            visitante_id: visitanteId,
            origem: "CHATBOT",
            motivo_resumo: `[ORAÇÃO] ${parsedJson.motivo_resumo}`,
            conteudo_original: parsedJson.texto_na_integra,
            gravidade: "BAIXA",
            pastor_responsavel_id: pastorResponsavelId,
            status: "PENDENTE",
          });
        }

        responseMessage = parsedJson.anonimo
          ? "Anotado em sigilo. 🙏"
          : `Anotado, ${parsedJson.nome_final}! 🙏`;
      } else if (parsedJson.intencao === "SOLICITACAO_PASTORAL") {
        await supabase.from("pedidos_oracao").insert({
          analise_ia_titulo: `[PASTORAL] ${parsedJson.motivo_resumo}`,
          texto_na_integra: parsedJson.texto_na_integra,
          analise_ia_motivo: "GABINETE_PASTORAL",
          analise_ia_gravidade: "ALTA",
          origem,
          membro_id: profile?.id,
          visitante_id: visitanteId,
        });

        await supabase.from("atendimentos_pastorais").insert({
          pessoa_id: profile?.id,
          visitante_id: visitanteId,
          origem: "CHATBOT",
          motivo_resumo: `[GABINETE] ${parsedJson.motivo_resumo}`,
          conteudo_original: parsedJson.texto_na_integra,
          gravidade: "MEDIA",
          pastor_responsavel_id: pastorResponsavelId,
          status: "PENDENTE",
        });

        notificarAdmin = true;
        responseMessage = `Entendido. Já notifiquei a liderança sobre: "${parsedJson.motivo_resumo}".`;
      } else if (parsedJson.intencao === "TESTEMUNHO") {
        await supabase.from("testemunhos").insert({
          titulo: parsedJson.motivo_resumo,
          mensagem: parsedJson.texto_na_integra,
          publicar: parsedJson.publicar || false,
          origem,
          autor_id: profile?.id,
          visitante_id: visitanteId,
        });

        responseMessage = parsedJson.publicar ? "Glória a Deus! 🙌" : "Amém! Salvo.";
      }
    } else {
      // Conversa continua
      await supabase
        .from("atendimentos_bot")
        .update({
          historico_conversa: [
            ...historico,
            { role: "user", content: inputTexto },
            { role: "assistant", content: aiContent },
          ],
        })
        .eq("id", sessao.id);
    }

    // Logs & Métricas
    await supabase.from("logs_auditoria_chat").insert({
      sessao_id: sessao.id,
      ator: "BOT",
      payload_raw: { resposta: responseMessage, json: parsedJson },
    });

    const executionTime = Date.now() - startTime;
    try {
      await supabase.rpc("log_edge_function_with_metrics", {
        p_function_name: FUNCTION_NAME,
        p_status: "success",
        p_execution_time_ms: executionTime,
        p_request_payload: requestPayload,
        p_response_payload: { reply: responseMessage, admin: notificarAdmin },
      });
    } catch {
      // Falha no logging não impede resposta
    }

    // Retorno para o Make
    return new Response(
      JSON.stringify({
        reply_message: responseMessage,
        notificar_admin: notificarAdmin,
        telefone_admin_destino: TELEFONE_PASTOR_PLANTAO,
        dados_contato: {
          telefone_usuario: telefone,
          nome_usuario: parsedJson?.nome_final || nome_perfil,
          motivo: parsedJson?.motivo_resumo || "",
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Erro desconhecido";
    console.error("ERRO FATAL:", msg);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: msg }),
      { status: 500, headers: corsHeaders }
    );
  }
});
