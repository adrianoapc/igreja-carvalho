import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

interface RequestBody {
  telefone: string;
  nome_perfil: string;
  tipo_mensagem?: 'text' | 'audio' | 'image';
  conteudo_texto?: string;
  media_id?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Variáveis de Ambiente
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
const WHATSAPP_API_TOKEN = Deno.env.get('WHATSAPP_API_TOKEN');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const TELEFONE_PASTOR_PLANTAO = "5517991985016"; 

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

// --- PROMPT COMPACTO E EFICIENTE ---
const SYSTEM_PROMPT = `
Você é da Equipe de Acolhimento da Igreja Carvalho. Atue como humano, cristão e objetivo.
REGRAS:
1. Nunca diga que é IA.
2. Nunca gere JSON nos fluxos de Dúvida.
3. Use a FAQ abaixo.

FAQ:
- Cultos: Dom 18h30 | Qui 19h30.
- Endereço: Av. Gabriel Jorge Cury, 232 – Rio Preto/SP.
- Pix: CNPJ 60.103.122/0001-35.
- Secretaria: (17) 99198-5016.

FLUXOS:
1. DÚVIDA: Responda texto. Não gere JSON.
2. ORAÇÃO: Colete Nome e Motivo. Pergunte se é Anônimo. Gere JSON no final.
3. PASTOR: Pergunte motivo breve. Diga que avisou a liderança. Gere JSON "SOLICITACAO_PASTORAL".
4. TESTEMUNHO: Colete relato. Pergunte se pode publicar. Gere JSON no final.

JSON FINAL (Use Markdown):
\`\`\`json
{
  "concluido": true,
  "intencao": "PEDIDO_ORACAO" | "TESTEMUNHO" | "SOLICITACAO_PASTORAL",
  "nome_final": "...",
  "motivo_resumo": "...",
  "texto_na_integra": "...",
  "categoria": "...",
  "anonimo": true,
  "publicar": false,
  "notificar_admin": false
}
\`\`\`
`;

// --- FUNÇÃO "NUCLEAR" DE LIMPEZA (ESSENCIAL) ---
function extractJsonAndText(aiContent: string) {
  let cleanText = aiContent;
  let parsedJson: any = null;

  try {
    // 1. Tenta pegar bloco ```json ... ```
    const markdownMatch = aiContent.match(/```(?:json)?([\s\S]*?)```/i);
    
    if (markdownMatch && markdownMatch[1]) {
      try {
        parsedJson = JSON.parse(markdownMatch[1].trim());
        cleanText = aiContent.replace(markdownMatch[0], '').trim();
      } catch (e) { console.log("Erro parse markdown"); }
    } 
    
    // 2. Se falhar, tenta pegar JSON puro no final
    if (!parsedJson) {
      const firstOpen = aiContent.indexOf('{');
      const lastClose = aiContent.lastIndexOf('}');
      if (firstOpen !== -1 && lastClose !== -1 && lastClose > firstOpen) {
         try {
            const tempJson = JSON.parse(aiContent.substring(firstOpen, lastClose + 1));
            if (tempJson.concluido) {
                parsedJson = tempJson;
                // Remove o JSON do texto visual
                cleanText = aiContent.substring(0, firstOpen).trim();
            }
         } catch (e) { /* Ignora */ }
      }
    }
  } catch (e) { console.error("Erro extrator:", e); }

  return { cleanText: cleanText || aiContent, parsedJson };
}

// --- SERVIDOR ---
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json() as RequestBody;
    const { telefone, nome_perfil, conteudo_texto } = body;
    const inputTexto = conteudo_texto || "";

    // 1. Sessão
    let { data: sessao } = await supabase.from('atendimentos_bot')
      .select('*').eq('telefone', telefone).neq('status', 'CONCLUIDO')
      .gt('updated_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).maybeSingle();

    let historico = sessao ? sessao.historico_conversa : [];

    if (!sessao) {
      const { data: nova } = await supabase.from('atendimentos_bot').insert({ telefone, status: 'INICIADO', historico_conversa: [] }).select().single();
      sessao = nova;
    }

    // 2. IA
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "system", content: `CONTEXTO: Tel: ${telefone}, Nome: ${nome_perfil}.` },
      ...historico.map((h: any) => ({ role: h.role, content: h.content })),
      { role: "user", content: inputTexto }
    ];

    const openAIRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o-mini', messages, temperature: 0.3 }),
    });

    const aiData = await openAIRes.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";

    // 3. LIMPEZA E EXTRAÇÃO
    const { cleanText, parsedJson } = extractJsonAndText(rawContent);
    let responseMessage = cleanText;
    let notificarAdmin = false;

    // 4. LÓGICA
    if (parsedJson?.concluido) {
      await supabase.from('atendimentos_bot').update({
        status: 'CONCLUIDO',
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: rawContent }]
      }).eq('id', sessao.id);

      const { data: profile } = await supabase.from('profiles').select('id').eq('telefone', telefone).maybeSingle();
      
      // Cria Lead se não existir
      let visitanteId = null;
      let origem = 'WABA_INTERNO';
      if (!profile) {
          origem = 'WABA_EXTERNO';
          const { data: lead } = await supabase.from('visitantes_leads').select('id').eq('telefone', telefone).maybeSingle();
          if (lead) visitanteId = lead.id;
          else {
              const { data: newLead } = await supabase.from('visitantes_leads').insert({ telefone, nome: parsedJson.nome_final || nome_perfil, origem: 'BOT' }).select('id').single();
              visitanteId = newLead?.id;
          }
      }

      // Salva nas tabelas corretas
      if (parsedJson.intencao === 'PEDIDO_ORACAO') {
        await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: parsedJson.motivo_resumo,
          texto_na_integra: parsedJson.texto_na_integra,
          analise_ia_motivo: parsedJson.categoria,
          anonimo: parsedJson.anonimo || false,
          origem, membro_id: profile?.id, visitante_id: visitanteId
        });
        responseMessage = parsedJson.anonimo ? "Anotado em sigilo. 🙏" : `Anotado, ${parsedJson.nome_final}! 🙏`;
      }
      else if (parsedJson.intencao === 'SOLICITACAO_PASTORAL') {
        await supabase.from('pedidos_oracao').insert({
          analise_ia_titulo: `[PASTORAL] ${parsedJson.motivo_resumo}`,
          texto_na_integra: parsedJson.texto_na_integra,
          analise_ia_motivo: 'GABINETE_PASTORAL',
          analise_ia_gravidade: 'ALTA',
          origem, membro_id: profile?.id, visitante_id: visitanteId
        });
        // FORCE TRUE PARA PASTORAL
        notificarAdmin = true; 
        responseMessage = `Entendido. Já notifiquei o pastor sobre: "${parsedJson.motivo_resumo}".`;
      }
      else if (parsedJson.intencao === 'TESTEMUNHO') {
        await supabase.from('testemunhos').insert({
          titulo: parsedJson.motivo_resumo, mensagem: parsedJson.texto_na_integra, publicar: parsedJson.publicar || false,
          origem, autor_id: profile?.id, visitante_id: visitanteId
        });
        responseMessage = parsedJson.publicar ? "Glória a Deus! 🙌" : "Amém! Guardado com a liderança.";
      }

    } else {
      // Conversa continua
      await supabase.from('atendimentos_bot').update({
        historico_conversa: [...historico, { role: 'user', content: inputTexto }, { role: 'assistant', content: rawContent }]
      }).eq('id', sessao.id);
    }

    // Logs
    await supabase.from('logs_auditoria_chat').insert({ sessao_id: sessao.id, ator: 'BOT', payload_raw: { resposta: responseMessage, json: parsedJson } });

    // 5. RESPOSTA FINAL (Make)
    return new Response(JSON.stringify({ 
      reply_message: responseMessage, // Texto limpo
      notificar_admin: notificarAdmin, // Flag corrigida
      telefone_admin_destino: TELEFONE_PASTOR_PLANTAO,
      dados_contato: { 
        telefone_usuario: telefone, 
        nome_usuario: parsedJson?.nome_final || nome_perfil, 
        motivo: parsedJson?.motivo_resumo || ""
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error('Erro:', error);
    return new Response(JSON.stringify({ error: 'Erro interno' }), { status: 500, headers: corsHeaders });
  }
});
