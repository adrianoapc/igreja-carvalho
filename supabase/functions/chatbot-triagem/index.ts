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
  intencao?: 'PEDIDO_ORACAO' | 'TESTEMUNHO' | 'DUVIDA_IGREJA' | 'OUTRO';
  nome_final?: string;
  motivo_resumo?: string;
  texto_na_integra?: string;
  categoria?: string;
  risco?: string;
  // Novos campos de controle
  anonimo?: boolean;   // Para oração
  publicar?: boolean;  // Para testemunho
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
  // 1. Busca na tabela de leads/visitantes
  const { data: existing } = await supabase
    .from('visitantes_leads')
    .select('id')
    .eq('telefone', telefone)
    .maybeSingle();

  if (existing) {
    await supabase.from('visitantes_leads').update({ data_ultimo_contato: new Date() }).eq('id', existing.id);
    return existing.id;
  }

  // 2. Cria novo se não existir
  const { data: newLead, error } = await supabase
    .from('visitantes_leads')
    .insert({
      telefone,
      nome: nome || 'Visitante WhatsApp',
      origem: 'WABA_BOT',
      estagio_funil: 'NOVO',
      data_ultimo_contato: new Date()
    })
    .select('id')
    .single();

  if (error) { console.error("Erro lead:", error); return null; }
  return newLead.id;
}

// --- SYSTEM PROMPT (A INTELIGÊNCIA) ---
// Aqui definimos as regras de Anônimo e Publicação
const SYSTEM_PROMPT = `
Você é o assistente virtual da Igreja Carvalho. Seu tom é PASTORAL, ACOLHEDOR e SEGURO. Use emojis (🙏, 🙌).

**SITUAÇÃO ATUAL:** Conversando via WhatsApp.

**BASE DE CONHECIMENTO (Para Dúvidas):**
- Cultos: Dom 18:30h, Quinta 19:30h.
- Endereço: Avenida Gabriel Jorge Cury, 232 - Parque Municipal - São José do Rio Preto - SP.
- Secretaria: (17) 99198-5016 (Horário comercial).
*(Se perguntarem algo fora disso ou se desejar atendimento pastoral, diga para ligar na secretaria.).*

**FLUXO DE ATENDIMENTO:**

1. **DÚVIDAS / SAUDAÇÃO:**
   - Responda a dúvida ou saúde.
   - Pergunte: "Gostaria de deixar um pedido de oração ou contar um testemunho?".
   - 🚫 NÃO gere JSON de conclusão aqui. Mantenha a conversa fluindo.

2. **PEDIDO DE ORAÇÃO (Fluxo Obrigatório):**
   - Passo 1: Colete o NOME e o MOTIVO.
   - Passo 2: **OBRIGATÓRIO:** Pergunte: "Você prefere que este pedido seja ANÔNIMO ou podemos compartilhar com a equipe de intercessão com seu nome?".
   - Passo 3: Somente após a resposta do anônimo, gere o JSON.

3. **TESTEMUNHO (Fluxo Obrigatório):**
   - Passo 1: Colete o RELATO e vibre com a pessoa ("Glória a Deus!").
   - Passo 2: **OBRIGATÓRIO:** Pergunte: "Podemos compartilhar essa vitória com a igreja (mural/culto) ou prefere manter apenas para a liderança?".
   - Passo 3: Somente após a permissão, gere o JSON.

**ESTRUTURA DE SAÍDA JSON (Gere APENAS quando o Passo 3 for concluído):**

Se PEDIDO_ORACAO:
{
  "concluido": true,
  "intencao": "PEDIDO_ORACAO",
  "nome_final": "Nome",
  "motivo_resumo": "Título curto",
  "texto_na_integra": "Relato completo",
  "categoria": "SAUDE|FAMILIA|ESPIRITUAL|FINANCEIRO|OUTROS",
  "anonimo": trueOrFalse // true se pediu sigilo, false se liberou
}

Se TESTEMUNHO:
{
  "concluido": true,
  "intencao": "TESTEMUNHO",
  "nome_final": "Nome",
  "motivo_resumo": "Título",
  "texto_na_integra": "Relato completo",
  "categoria": "CURA|PROVISAO|...",
  "publicar": trueOrFalse // true se liberou divulgar, false se é restrito
}
`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as RequestBody;
    const { telefone, nome_perfil, tipo_mensagem, media_id } = body;
    let { conteudo_texto } = body;

    // 1. Áudio para Texto
    if (tipo_mensagem === 'audio' && media_id) {
      const transcricao = await processarAudio(media_id);
      conteudo_texto = transcricao ? `[Áudio Transcrito]: ${transcricao}` : "[Erro áudio]";
    }

    const inputTexto = conteudo_texto || "";

    // 2. Gestão de Sessão
    let { data: sessao } = await supabase
      .from('atendimentos_bot')
      .select('*')
      .eq('telefone', telefone)
      .neq('status', 'CONCLUIDO')
      .gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    let historico = sessao ? sessao.historico_conversa : [];

    if (!sessao) {
      const { data: nova } = await supabase.from('atendimentos_bot').insert({ telefone, status: 'INICIADO', historico_conversa: [] }).select().single();
      sessao = nova;
    }

    // 3. Auditoria (Input)
    await supabase.from('logs_auditoria_chat').insert({
      sessao_id: sessao.id, ator: 'USER', payload_raw: { texto: inputTexto, tipo: tipo_mensagem }
    });

    // 4. Inteligência (OpenAI)
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historico.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: `Nome Perfil: ${nome_perfil}. Msg: ${inputTexto}` }
    ];

    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.3 }),
    });

    const aiData = await openAIRes.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    // Tenta extrair JSON
    let parsedJson: ChatResponse | null = null;
    try {
      const clean = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
      if (clean.startsWith('{')) parsedJson = JSON.parse(clean);
    } catch (e) { /* Texto normal */ }

    let responseMessage = aiContent;

    // 5. Execução (Se concluído)
    if (parsedJson?.concluido) {
      // Fecha a sessão
      await supabase.from('atendimentos_bot').update({
        status: 'CONCLUIDO',
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);

      // Verifica Membro ou Visitante
      const { data: profile } = await supabase.from('profiles').select('id').eq('telefone', telefone).maybeSingle();
      
      let visitanteId = null;
      let origem = 'WABA_INTERNO';

      if (!profile) {
        origem = 'WABA_EXTERNO';
        visitanteId = await getOrCreateLead(telefone, parsedJson.nome_final || nome_perfil);
      }

      // ROTA: PEDIDO DE ORAÇÃO
      if (parsedJson.intencao === 'PEDIDO_ORACAO') {
        await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: parsedJson.motivo_resumo,
          texto_na_integra: parsedJson.texto_na_integra,
          analise_ia_motivo: parsedJson.categoria,
          anonimo: parsedJson.anonimo || false, // <--- CAMPO IMPORTANTE
          origem: origem,
          membro_id: profile?.id || null,
          visitante_id: visitanteId,
          status: 'pendente'
        });
        
        responseMessage = parsedJson.anonimo 
          ? `Entendido. Seu pedido foi registrado de forma ANÔNIMA. Vamos orar por você em secreto. 🙏`
          : `Combinado, ${parsedJson.nome_final || 'irmão'}! Seu pedido foi enviado para nossa equipe de intercessão. 🙏`;
      } 
      
      // ROTA: TESTEMUNHO
      else if (parsedJson.intencao === 'TESTEMUNHO') {
        await supabase.from('testemunhos').insert({
          titulo: parsedJson.motivo_resumo,
          mensagem: parsedJson.texto_na_integra,
          categoria: parsedJson.categoria || 'ESPIRITUAL',
          status: 'aberto',
          publicar: parsedJson.publicar || false, // <--- CAMPO IMPORTANTE (Visibilidade)
          autor_id: profile?.id || null,
          visitante_id: visitanteId,
          origem: origem,
          nome_externo: profile ? null : (parsedJson.nome_final || nome_perfil),
          telefone_externo: profile ? null : telefone
        });

        responseMessage = parsedJson.publicar
          ? `Que bênção! 🙌 Registramos seu testemunho e ele poderá edificar a igreja. Glória a Deus!`
          : `Amém! Registramos seu testemunho para conhecimento da liderança. Obrigado por compartilhar!`;
      }

    } else {
      // Conversa continua (Status permanece INICIADO)
      await supabase.from('atendimentos_bot').update({
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);
    }

    // 6. Auditoria (Output)
    await supabase.from('logs_auditoria_chat').insert({
      sessao_id: sessao.id, ator: 'BOT', payload_raw: { resposta: responseMessage, json: parsedJson }
    });

    return new Response(JSON.stringify({ reply_message: responseMessage }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders });
  }
});
