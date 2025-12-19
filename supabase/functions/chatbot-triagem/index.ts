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
  "categoria": "GABINETE",
  "notificar_admin": true
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
      console.log(`⚠️ [CONFIG] Usando configuração padrão (Erro: ${error.message})`);
      return { textModel: DEFAULT_TEXT_MODEL, audioModel: DEFAULT_AUDIO_MODEL, systemPrompt: DEFAULT_SYSTEM_PROMPT, audioPrompt: null };
    }

    if (!config) {
      console.log(`⚠️ [CONFIG] Nenhuma config encontrada. Usando padrão.`);
      return { textModel: DEFAULT_TEXT_MODEL, audioModel: DEFAULT_AUDIO_MODEL, systemPrompt: DEFAULT_SYSTEM_PROMPT, audioPrompt: null };
    }

    return {
      textModel: config.modelo_texto || DEFAULT_TEXT_MODEL,
      audioModel: config.modelo_audio || DEFAULT_AUDIO_MODEL,
      systemPrompt: config.role_texto || DEFAULT_SYSTEM_PROMPT,
      audioPrompt: config.role_audio || null
    };
  } catch (err) {
    console.error('❌ [CONFIG] Erro inesperado:', err);
    return { textModel: DEFAULT_TEXT_MODEL, audioModel: DEFAULT_AUDIO_MODEL, systemPrompt: DEFAULT_SYSTEM_PROMPT, audioPrompt: null };
  }
}

// --- FUNÇÕES AUXILIARES ---

// 🔥 EXTRATOR DE JSON "NUCLEAR" (AGRESSIVO)
function extractJsonAndText(aiContent: string) {
  let cleanText = aiContent;
  let parsedJson: any = null;

  console.log("🧹 [CLEANER] Input recebido da IA:", aiContent.substring(0, 100) + "...");

  try {
    // 1. Tenta achar o JSON usando regex de Markdown
    const markdownMatch = aiContent.match(/```(?:json)?([\s\S]*?)```/i);
    if (markdownMatch && markdownMatch[1]) {
        console.log("🧹 [CLEANER] JSON encontrado via Markdown!");
        try {
            parsedJson = JSON.parse(markdownMatch[1].trim());
            cleanText = aiContent.replace(markdownMatch[0], '').trim();
        } catch (e) { console.log("🧹 [CLEANER] Falha no parse do Markdown JSON"); }
    }

    // 2. Se falhar, busca agressiva por chaves { }
    if (!parsedJson) {
        console.log("🧹 [CLEANER] Tentando busca agressiva por chaves { }");
        const firstOpen = aiContent.indexOf('{');
        const lastClose = aiContent.lastIndexOf('}');
        
        if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
             const potentialJson = aiContent.substring(firstOpen, lastClose + 1);
             try {
                const tempJson = JSON.parse(potentialJson);
                // Validação mínima para garantir que é o nosso JSON
                if (tempJson.concluido === true) {
                    console.log("🧹 [CLEANER] JSON válido encontrado via chaves!");
                    parsedJson = tempJson;
                    // Remove o JSON do texto, mantendo o que vem antes e depois
                    const textBefore = aiContent.substring(0, firstOpen).trim();
                    const textAfter = aiContent.substring(lastClose + 1).trim();
                    cleanText = [textBefore, textAfter].filter(t => t.length > 0).join('\n\n');
                }
             } catch (e) { 
                 console.log("🧹 [CLEANER] Texto entre chaves não era JSON válido: " + potentialJson.substring(0, 50)); 
             }
        }
    }
  } catch (e) {
    console.error("❌ [CLEANER] Erro crítico no parser:", e);
  }

  // Remove sobras de markdown se houver
  cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();

  return { cleanText, parsedJson };
}

async function processarAudio(mediaId: string, audioModel: string): Promise<string | null> {
  try {
    if (!WHATSAPP_API_TOKEN || !OPENAI_API_KEY) return null;
    
    const mediaUrlRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, { 
      headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } 
    });
    const mediaData = await mediaUrlRes.json();
    if (!mediaData.url) return null;
    
    const audioRes = await fetch(mediaData.url, { 
      headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } 
    });
    const audioBlob = await audioRes.blob();
    
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', audioModel);
    
    const transRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData
    });
    
    const data = await transRes.json();
    return data.text;
  } catch (e) {
    console.error("❌ [AUDIO] Erro:", e);
    return null;
  }
}

async function getOrCreateLead(telefone: string, nome: string) {
  const { data: existing } = await supabase.from('visitantes_leads').select('id').eq('telefone', telefone).maybeSingle();
  if (existing) {
    await supabase.from('visitantes_leads').update
