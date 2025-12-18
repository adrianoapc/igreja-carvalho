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
}

// --- CONFIGURAÇÃO ---
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const WHATSAPP_API_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// --- FUNÇÕES AUXILIARES ---

// 1. Processar Áudio (Transcrição via Lovable AI Gemini)
async function processarAudio(mediaId: string): Promise<string | null> {
  try {
    if (!WHATSAPP_API_TOKEN || !LOVABLE_API_KEY) return null;
    
    // Pega URL de download do WhatsApp
    const mediaUrlRes = await fetch(`https://graph.facebook.com/v18.0/${mediaId}`, { 
      headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } 
    });
    const mediaData = await mediaUrlRes.json();
    if (!mediaData.url) return null;
    
    // Baixa o binário do áudio
    const audioRes = await fetch(mediaData.url, { 
      headers: { 'Authorization': `Bearer ${WHATSAPP_API_TOKEN}` } 
    });
    const audioBlob = await audioRes.blob();
    
    // Converte para base64
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Usa Lovable AI (Gemini) para transcrever
    const transRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Transcreva este áudio em português. Retorne APENAS o texto transcrito, sem explicações.' },
              { 
                type: 'input_audio', 
                input_audio: { 
                  data: base64Audio, 
                  format: 'ogg' 
                } 
              }
            ]
          }
        ]
      }),
    });
    
    const data = await transRes.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.error("Erro processamento audio:", e);
    return null;
  }
}

// 2. Get ou Create VISITANTE LEAD (CRM)
async function getOrCreateLead(telefone: string, nome: string) {
  // Busca por telefone na tabela visitantes_leads
  const { data: existing } = await supabase
    .from('visitantes_leads')
    .select('id')
    .eq('telefone', telefone)
    .maybeSingle();

  if (existing) {
    // Atualiza data do último contato
    await supabase.from('visitantes_leads')
      .update({ data_ultimo_contato: new Date() })
      .eq('id', existing.id);
    return existing.id;
  }

  // Cria novo Lead
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

  if (error) {
    console.error("Erro criar lead:", error);
    return null;
  }
  return newLead.id;
}

// --- SYSTEM PROMPT ---
const SYSTEM_PROMPT = `Você é o assistente virtual de acolhimento da Igreja Carvalho.

Objetivo: Coletar Nome Real e Motivo de Oração.

**CLASSIFICAÇÃO DE INTENÇÃO:**

Primeiro, classifique a intenção do usuário em uma das categorias:

- PEDIDO_ORACAO: Pessoa quer pedir oração por algo
- TESTEMUNHO: Pessoa quer compartilhar um testemunho/gratidão
- DUVIDA_IGREJA: Perguntas sobre horários, endereço, eventos
- CONVERSA_PASTORAL: Precisa de aconselhamento/conversa
- SAUDACAO: Apenas cumprimentando
- OUTRO: Não se encaixa nas anteriores

**REGRAS GERAIS:**

1. Se for a primeira mensagem, avise sobre a LGPD/Privacidade de forma breve.
2. Seja breve e empático. Não pregue nem prometa milagres.
3. Se detectar risco de vida (suicídio, crime, violência), retorne JSON com "risco": "CRITICO".
4. O campo "texto_na_integra" deve ser a compilação fiel de todo o relato do usuário.
5. Se tiver Nome e Motivo, retorne APENAS um JSON (sem texto adicional).
6. Se faltar dados, retorne APENAS texto (string) com a próxima pergunta.
7. Nunca retorne JSON e texto juntos. Ou um ou outro.

**PARA PEDIDO_ORACAO:**
Colete: Nome Real e Motivo de Oração.
Quando tiver os dados, retorne JSON no formato abaixo.

**PARA TESTEMUNHO:**
Colete: Nome Real e o Testemunho completo.
Quando tiver os dados, retorne JSON com intencao: "TESTEMUNHO".

**PARA DUVIDA_IGREJA:**
Responda diretamente com informações úteis:
- Cultos: Domingos 9h e 18h, Quartas 19h30
- Endereço: Pergunte ao usuário sua localização para indicar a unidade mais próxima
- Eventos: Mencione que podem verificar no app ou site

**PARA CONVERSA_PASTORAL:**
Informe que um pastor entrará em contato e colete nome e telefone.

**FORMATO DE RESPOSTA:**

- Se faltar dados ou for conversa: retorne APENAS texto (string)
- Se tiver dados completos: retorne APENAS JSON (sem texto adicional):

{
  "concluido": true,
  "intencao": "PEDIDO_ORACAO|TESTEMUNHO|CONVERSA_PASTORAL",
  "nome_final": "...",
  "motivo_resumo": "...",
  "categoria": "SAUDE|FAMILIA|ESPIRITUAL|FINANCEIRO|OUTROS",
  "texto_na_integra": "Compilação fiel de todo o relato",
  "risco": "BAIXO|MEDIO|ALTO|CRITICO"
}

**IMPORTANTE:**
- Nunca retorne JSON e texto juntos. Ou um ou outro.
- Se receber descrição de áudio ou imagem, trate o conteúdo normalmente.
`;

// --- HANDLER PRINCIPAL ---
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as RequestBody;
    const { telefone, nome_perfil, tipo_mensagem, media_id } = body;
    let { conteudo_texto } = body;

    // 1. Processar Multimodalidade (Áudio)
    if (tipo_mensagem === 'audio' && media_id) {
      const transcricao = await processarAudio(media_id);
      if (transcricao) {
        conteudo_texto = `[Áudio Transcrito]: ${transcricao}`;
      } else {
        conteudo_texto = "[Erro ao baixar áudio. Peça para o usuário escrever]";
      }
    }

    const inputTexto = conteudo_texto || "";

    // 2. Gestão de Sessão (State Machine)
    let { data: sessao } = await supabase
      .from('atendimentos_bot')
      .select('*')
      .eq('telefone', telefone)
      .neq('status', 'CONCLUIDO')
      .gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .maybeSingle();

    let historico: any[] = [];

    if (sessao) {
      historico = sessao.historico_conversa || [];
    } else {
      const { data: nova, error } = await supabase
        .from('atendimentos_bot')
        .insert({ telefone, status: 'INICIADO', historico_conversa: [] })
        .select().single();
      if (error) throw error;
      sessao = nova;
    }

    // 3. Auditoria (Log User)
    await supabase.from('logs_auditoria_chat').insert({
      sessao_id: sessao.id,
      ator: 'USER',
      payload_raw: { tipo: tipo_mensagem, texto: inputTexto, nome: nome_perfil }
    });

    // 4. Chamada Lovable AI (Gemini)
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      ...historico.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: `Nome: ${nome_perfil}. Msg: ${inputTexto}` }
    ];

    const aiRes = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model: 'google/gemini-2.5-flash', messages }),
    });

    const aiData = await aiRes.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    // Tentar parsear JSON
    let parsedJson: ChatResponse | null = null;
    try {
      const clean = aiContent.replace(/```json/g, '').replace(/```/g, '').trim();
      if (clean.startsWith('{')) parsedJson = JSON.parse(clean);
    } catch (e) { /* Texto normal */ }

    let responseMessage = aiContent;

    // 5. Lógica de Negócio (Se concluiu)
    if (parsedJson?.concluido) {
      // Fecha sessão
      await supabase.from('atendimentos_bot').update({
        status: 'CONCLUIDO',
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);

      // Identificar Membro vs Visitante
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('telefone', telefone)
        .maybeSingle();

      let visitanteId = null;
      let origem = 'WABA_INTERNO';

      if (!profile) {
        origem = 'WABA_EXTERNO';
        // Cria ou atualiza na tabela VISITANTES_LEADS
        visitanteId = await getOrCreateLead(telefone, parsedJson.nome_final || nome_perfil);
      }

      // Salvar Pedido
      if (parsedJson.intencao === 'PEDIDO_ORACAO') {
        await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: parsedJson.motivo_resumo,
          texto_na_integra: parsedJson.texto_na_integra,
          origem: origem,
          membro_id: profile?.id || null,
          visitante_id: visitanteId,
          analise_ia_motivo: parsedJson.categoria,
          status: 'pendente'
        });
        responseMessage = `Seu pedido foi anotado, ${parsedJson.nome_final || 'irmão(ã)'}! Vamos orar por isso. 🙏`;
      } 
      
      // Salvar Testemunho
      else if (parsedJson.intencao === 'TESTEMUNHO') {
        await supabase.from('testemunhos').insert({
          titulo: parsedJson.motivo_resumo,
          mensagem: parsedJson.texto_na_integra,
          categoria: parsedJson.categoria || 'ESPIRITUAL',
          status: 'aberto',
          autor_id: profile?.id || null,
          visitante_id: visitanteId,
          origem: origem,
          nome_externo: profile ? null : (parsedJson.nome_final || nome_perfil),
          telefone_externo: profile ? null : telefone
        });
        responseMessage = `Glória a Deus! Testemunho recebido. 🙌`;
      }

    } else {
      // Apenas atualiza histórico
      await supabase.from('atendimentos_bot').update({
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: aiContent }]
      }).eq('id', sessao.id);
    }

    // 6. Auditoria (Log Bot)
    await supabase.from('logs_auditoria_chat').insert({
      sessao_id: sessao.id,
      ator: 'BOT',
      payload_raw: { resposta: responseMessage, json_ia: parsedJson }
    });

    return new Response(
      JSON.stringify({ reply_message: parsedJson?.risco === 'CRITICO' ? "⚠️ Atendimento Humano Solicitado" : responseMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro function:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders });
  }
});
