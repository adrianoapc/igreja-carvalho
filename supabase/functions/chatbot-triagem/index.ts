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
}

// --- CONFIGURAÇÃO ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const WHATSAPP_API_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// --- FUNÇÕES AUXILIARES ---
async function processarAudio(mediaId: string): Promise<string | null> {
  try {
    if (!WHATSAPP_API_TOKEN) return null;
    const mediaUrlRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, { headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } });
    const mediaData = await mediaUrlRes.json();
    if (!mediaData.url) return null;
    const audioRes = await fetch(mediaData.url, { headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } });
    const audioBlob = await audioRes.blob();
    const formData = new FormData();
    formData.append('file', audioBlob, 'audio.ogg');
    formData.append('model', 'whisper-1');
    const transRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: formData
    });
    const data = await transRes.json();
    return data.text;
  } catch (e) {
    console.error("Erro audio:", e);
    return null;
  }
}

async function getOrCreateLead(telefone: string, nome: string) {
  const { data: existing } = await supabase.from('visitantes_leads').select('id').eq('telefone', telefone).maybeSingle();
  if (existing) {
    await supabase.from('visitantes_leads').update({ data_ultimo_contato: new Date() }).eq('id', existing.id);
    return existing.id;
  }
  const { data: newLead } = await supabase.from('visitantes_leads').insert({
      telefone, nome: nome || 'Visitante WhatsApp', origem: 'WABA_BOT', estagio_funil: 'NOVO', data_ultimo_contato: new Date()
  }).select('id').single();
  return newLead?.id;
}

// --- SYSTEM PROMPT (AGORA COM FAQ + REGRAS DE AÇÃO) ---
const BASE_SYSTEM_PROMPT = `
Você é da **Equipe de Acolhimento Digital da Igreja Carvalho**. 
Atue como uma pessoa real, cristã, empática e eficiente.

**REGRAS DE PERSONA (IMPORTANTE):**
1. 🚫 **NUNCA** diga que é uma IA, robô ou "modelo de linguagem". Se perguntarem, diga "Sou da equipe de intercessão".
2. 🚫 **NUNCA** peça o número de telefone. (O sistema já identificou).

**BASE DE CONHECIMENTO (FAQ) - Use APENAS estes dados para dúvidas:**
📅 **HORÁRIOS DE CULTO:**
- Cultos: Dom 18:30h, Quinta 19:30h.



📍 **LOCALIZAÇÃO:**
- Endereço: Avenida Gabriel Jorge Cury, 232 - Parque Municipal - São José do Rio Preto - SP.
- Ponto de referência: Próximo ao Estádio do Teixeirão.

💰 **CONTRIBUIÇÃO:**
- PIX Oficial: [CNPJ: 60.103.122/0001-35].

📞 **SECRETARIA / CONTATO:**
- Telefone: (17) 99198-5016 
- Horário: Seg a Sex, das 9h às 17h.

---

**FLUXO DE TRIAGEM:**

1. **DÚVIDAS / SAUDAÇÃO:**
   - Responda usando a FAQ acima.
   - Sempre termine oferecendo: "Posso anotar um pedido de oração por você hoje?".

2. **PEDIDO DE ORAÇÃO:**
   - Passo 1: Colete NOME e MOTIVO.
   - Passo 2: **OBRIGATÓRIO:** Pergunte: "Prefere que seja ANÔNIMO ou posso compartilhar com a equipe de intercessão?".
   - Passo 3: Gere JSON apenas após a resposta do anônimo.

3. **SOLICITAÇÃO DE PASTOR / LIDERANÇA:**
   - Se pedirem para falar com pastor, ajuda urgente ou gabinete:
   - Passo 1: Pergunte o motivo resumido ("Para eu chamar o pastor certo, é sobre qual assunto?").
   - Passo 2: Gere o JSON "SOLICITACAO_PASTORAL".
   - AVISO AO USUÁRIO: "Já notifiquei o pastor de plantão aqui pelo sistema. Ele recebeu seu contato e o motivo." (Não peça telefone).

4. **TESTEMUNHO:**
   - Passo 1: Colete o RELATO.
   - Passo 2: **OBRIGATÓRIO:** Pergunte: "Podemos PUBLICAR essa vitória para edificar a igreja ou prefere manter restrito à liderança?".
   - Passo 3: Gere JSON apenas após a confirmação.

**ESTRUTURA JSON (Gere APENAS quando concluído):**
Se PEDIDO_ORACAO: { "concluido": true, "intencao": "PEDIDO_ORACAO", "nome_final": "...", "motivo_resumo": "...", "texto_na_integra": "...", "categoria": "...", "anonimo": true/false }
Se SOLICITACAO_PASTORAL: { "concluido": true, "intencao": "SOLICITACAO_PASTORAL", "nome_final": "...", "motivo_resumo": "Assunto", "texto_na_integra": "Detalhes...", "categoria": "GABINETE" }
Se TESTEMUNHO: { "concluido": true, "intencao": "TESTEMUNHO", "nome_final": "...", "motivo_resumo": "...", "texto_na_integra": "...", "publicar": true/false }
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as RequestBody;
    const { telefone, nome_perfil, tipo_mensagem, media_id } = body;
    let { conteudo_texto } = body;

    // 1. Áudio
    if (tipo_mensagem === 'audio' && media_id) {
      const transcricao = await processarAudio(media_id);
      conteudo_texto = transcricao ? `[Áudio Transcrito]: ${transcricao}` : "[Erro áudio]";
    }
    const inputTexto = conteudo_texto || "";

    // 2. Sessão
    let { data: sessao } = await supabase.from('atendimentos_bot')
      .select('*').eq('telefone', telefone).neq('status', 'CONCLUIDO')
      .gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).maybeSingle();

    let historico = sessao ? sessao.historico_conversa : [];

    if (!sessao) {
      const { data: nova } = await supabase.from('atendimentos_bot').insert({ telefone, status: 'INICIADO', historico_conversa: [] }).select().single();
      sessao = nova;
    }

    await supabase.from('logs_auditoria_chat').insert({ sessao_id: sessao.id, ator: 'USER', payload_raw: { texto: inputTexto } });

    // 3. IA (Com injeção de contexto)
    const messages = [
      { role: "system", content: BASE_SYSTEM_PROMPT },
      { role: "system", content: `CONTEXTO USUÁRIO: Telefone: ${telefone}. Nome perfil: ${nome_perfil}. (Não peça esses dados, aja como se já soubesse).` },
      ...historico.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: inputTexto }
    ];

    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.3 }),
    });

    const aiData = await openAIRes.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    let parsedJson: ChatResponse | null = null;
    try {
      const clean = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
      if (clean.startsWith('{')) parsedJson = JSON.parse(clean);
    } catch (e) { }

    let responseMessage = aiContent;
    let notificarAdmin = false;

    // 4. Lógica de Execução
    if (parsedJson?.concluido) {
      await supabase.from('atendimentos_bot').update({
        status: 'CONCLUIDO',
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);

      const { data: profile } = await supabase.from('profiles').select('id').eq('telefone', telefone).maybeSingle();
      let visitanteId = null;
      let origem = 'WABA_INTERNO';

      if (!profile) {
        origem = 'WABA_EXTERNO';
        visitanteId = await getOrCreateLead(telefone, parsedJson.nome_final || nome_perfil);
      }

      if (parsedJson.intencao === 'PEDIDO_ORACAO') {
        await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: parsedJson.motivo_resumo,
          texto_na_integra: parsedJson.texto_na_integra,
          analise_ia_motivo: parsedJson.categoria,
          anonimo: parsedJson.anonimo || false,
          origem, membro_id: profile?.id, visitante_id: visitanteId
        });
        responseMessage = parsedJson.anonimo 
          ? "Entendido. Seu pedido foi registrado como ANÔNIMO e mantido em sigilo. 🙏"
          : `Combinado, ${parsedJson.nome_final || 'irmão'}! Já enviei seu pedido para a equipe de intercessão. 🙏`;
      }
      
      else if (parsedJson.intencao === 'SOLICITACAO_PASTORAL') {
        await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: `ATENDIMENTO PASTORAL: ${parsedJson.motivo_resumo}`,
          texto_na_integra: `[SOLICITAÇÃO DE PASTOR] ${parsedJson.texto_na_integra}`,
          analise_ia_motivo: 'GABINETE_PASTORAL',
          analise_ia_gravidade: 'ALTA',
          origem, membro_id: profile?.id, visitante_id: visitanteId
        });
        notificarAdmin = true; // ATIVA O ROUTER DO MAKE
        responseMessage = `Entendido. Já notifiquei o pastor de plantão sobre: "${parsedJson.motivo_resumo}". Ele recebeu seu contato agora.`;
      }

      else if (parsedJson.intencao === 'TESTEMUNHO') {
        await supabase.from('testemunhos').insert({
          titulo: parsedJson.motivo_resumo, mensagem: parsedJson.texto_na_integra, publicar: parsedJson.publicar || false,
          origem, autor_id: profile?.id, visitante_id: visitanteId
        });
        responseMessage = parsedJson.publicar
          ? "Glória a Deus! 🙌 Registramos sua vitória para compartilhar com a igreja."
          : "Amém! Seu relato foi salvo para a liderança. Obrigado por compartilhar!";
      }

    } else {
      await supabase.from('atendimentos_bot').update({
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);
    }

    await supabase.from('logs_auditoria_chat').insert({ sessao_id: sessao.id, ator: 'BOT', payload_raw: { resposta: responseMessage, json: parsedJson } });

    return new Response(JSON.stringify({ 
      reply_message: responseMessage,
      notificar_admin: notificarAdmin,
      dados_contato: { telefone, nome: parsedJson?.nome_final || nome_perfil, motivo: parsedJson?.motivo_resumo }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders });
  }
});
