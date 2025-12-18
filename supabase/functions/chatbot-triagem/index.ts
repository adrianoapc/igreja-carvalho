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

// --- SYSTEM PROMPT OTIMIZADO ---
const BASE_SYSTEM_PROMPT = `
Você é da **Equipe de Acolhimento Digital da Igreja Carvalho**.
Atue como uma pessoa real, cristã, empática e objetiva.

**⛔ REGRAS CRÍTICAS (PARA EVITAR ERROS):**
1. **NUNCA** diga que é uma IA , robô ou "modelo de linguagem". Se perguntarem, diga "Sou da equipe de apoio".
2. **NUNCA** gere JSON se estiver apenas tirando dúvidas.
3. **NUNCA** invente endereços ou horários. Use a FAQ abaixo.

**BASE DE CONHECIMENTO (FAQ) - Use APENAS estes dados para dúvidas:**
📅 **HORÁRIOS DE CULTO:**
- Cultos: Dom 18:30h, Quinta 19:30h.



📍 **LOCALIZAÇÃO:**
- Endereço: Avenida Gabriel Jorge Cury, 232 - Parque Municipal - São José do Rio Preto - SP.
- Ponto de referência: 

💰 **CONTRIBUIÇÃO:**
- ].

📞 **SECRETARIA / CONTATO:**
- Telefone: 
- Horário: Seg a Sex, das 9h às 17h.

**📘 FAQ - BASE DE CONHECIMENTO (RESPOSTAS RÁPIDAS):**
Se perguntarem isso, RESPONDA O TEXTO DIRETAMENTE.
- **Horários:** Domingo às 18:30h | Quinta às 19:30h (Ensino)
- **Endereço:** Avenida Gabriel Jorge Cury, 232 - Parque Municipal - São José do Rio Preto - SP. Próximo ao Estádio do Teixeirão.
- **Pix/Dízimo:** CNPJ: 60.103.122/0001-35.
- **Contato/Secretaria:** (17) 99198-5016 (Seg-Sex 9h-17h).

---

**🚦 FLUXO DE DECISÃO (Siga na ordem):**

**1. É UMA DÚVIDA SOBRE A IGREJA? (Horário, Endereço, Pix)**
   - AÇÃO: Responda a dúvida usando a FAQ.
   - FINALIZAÇÃO: Pergunte "Posso ajudar com algum pedido de oração hoje?".
   - **JSON:** NÃO GERE JSON NESTA FASE. APENAS TEXTO.

**2. É UM PEDIDO DE ORAÇÃO?**
   - PASSO A: Pergunte NOME e MOTIVO (se não tiver).
   - PASSO B: Pergunte: "Prefere que seja ANÔNIMO ou posso compartilhar com a equipe?".
   - PASSO C: (Só agora) Gere o JSON de conclusão.

**3. É UM TESTEMUNHO?**
   - PASSO A: Pergunte o RELATO.
   - PASSO B: Pergunte: "Podemos PUBLICAR ou prefere manter restrito?".
   - PASSO C: (Só agora) Gere o JSON de conclusão.

**4. QUER FALAR COM PASTOR?**
   - PASSO A: Pergunte o assunto resumido.
   - PASSO B: Diga "Já avisei o pastor.".
   - PASSO C: Gere o JSON "SOLICITACAO_PASTORAL".

---

**ESTRUTURA JSON (Use APENAS no final dos fluxos 2, 3 e 4):**
Se PEDIDO_ORACAO: { "concluido": true, "intencao": "PEDIDO_ORACAO", "nome_final": "...", "motivo_resumo": "...", "texto_na_integra": "...", "categoria": "...", "anonimo": true/false }
Se SOLICITACAO_PASTORAL: { "concluido": true, "intencao": "SOLICITACAO_PASTORAL", "nome_final": "...", "motivo_resumo": "...", "texto_na_integra": "...", "categoria": "GABINETE" }
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

    // 3. IA
    const messages = [
      { role: "system", content: BASE_SYSTEM_PROMPT },
      { role: "system", content: `CONTEXTO USUÁRIO: Telefone: ${telefone}. Nome perfil: ${nome_perfil}.` },
      ...historico.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: inputTexto }
    ];

    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.3 }), // Temperature baixo evita criatividade excessiva
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

    // 4. Execução Lógica
    if (parsedJson?.concluido) {
      // Encerra sessão
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
          ? "Seu pedido foi anotado em sigilo (ANÔNIMO). Estaremos orando. 🙏"
          : `Anotado, ${parsedJson.nome_final}! Já enviei para a equipe de oração. 🙏`;
      }
      else if (parsedJson.intencao === 'SOLICITACAO_PASTORAL') {
        await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: `ATENDIMENTO PASTORAL: ${parsedJson.motivo_resumo}`,
          texto_na_integra: `[SOLICITAÇÃO DE PASTOR] ${parsedJson.texto_na_integra}`,
          analise_ia_motivo: 'GABINETE_PASTORAL', analise_ia_gravidade: 'ALTA',
          origem, membro_id: profile?.id, visitante_id: visitanteId
        });
        notificarAdmin = true;
        responseMessage = `Entendido. Já notifiquei o pastor sobre: "${parsedJson.motivo_resumo}".`;
      }
      else if (parsedJson.intencao === 'TESTEMUNHO') {
        await supabase.from('testemunhos').insert({
          titulo: parsedJson.motivo_resumo, mensagem: parsedJson.texto_na_integra, publicar: parsedJson.publicar || false,
          origem, autor_id: profile?.id, visitante_id: visitanteId
        });
        responseMessage = parsedJson.publicar
          ? "Glória a Deus! 🙌 Vamos compartilhar sua vitória com a igreja."
          : "Amém! Seu relato foi salvo para a liderança.";
      }

    } else {
      // Conversa continua
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
