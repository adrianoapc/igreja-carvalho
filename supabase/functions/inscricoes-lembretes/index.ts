import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getActiveWhatsAppProvider } from "../_shared/secrets.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function enviarWhatsApp(
  supabase: SupabaseClient,
  igrejaId: string,
  telefone: string,
  mensagem: string
): Promise<boolean> {
  const provider = await getActiveWhatsAppProvider(supabase, igrejaId);
  if (!provider) return false;

  const { tipo, config } = provider;

  if (tipo === "whatsapp_make") {
    if (!config.url) return false;
    const payload = {
      telefone,
      mensagem,
      template: "inscricao_pagamento",
      timestamp: new Date().toISOString(),
    };
    const response = await fetch(config.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return response.ok;
  }

  console.warn(`[inscricoes-lembretes] Provedor ${tipo} nao suportado`);
  return false;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const now = new Date();
  const reminderThreshold = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const cancelThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const reminderIso = reminderThreshold.toISOString();
  const cancelIso = cancelThreshold.toISOString();

  const { data: pendentesLembrete, error: lembreteError } = await supabase
    .from("inscricoes_eventos")
    .select(
      `
      id,
      created_at,
      pessoa_id,
      evento_id,
      igreja_id,
      lembrete_pagamento_em,
      pessoa:profiles!inscricoes_eventos_pessoa_id_fkey (nome, telefone),
      evento:eventos!inscricoes_eventos_evento_id_fkey (titulo, requer_pagamento, status)
      `
    )
    .eq("status_pagamento", "pendente")
    .is("lembrete_pagamento_em", null)
    .lte("created_at", reminderIso)
    .gt("created_at", cancelIso);

  if (lembreteError) {
    console.error("Erro ao buscar pendentes para lembrete:", lembreteError);
  }

  let lembretesEnviados = 0;
  for (const inscricao of pendentesLembrete || []) {
    if (!inscricao.evento?.requer_pagamento || inscricao.evento?.status === "cancelado") {
      continue;
    }

    const telefone = inscricao.pessoa?.telefone;
    if (!telefone || !inscricao.igreja_id) {
      continue;
    }

    const prazo = new Date(new Date(inscricao.created_at).getTime() + 24 * 60 * 60 * 1000);
    const mensagem = `Sua vaga esta reservada ate ${prazo.toLocaleString("pt-BR")}. Realize o pagamento para confirmar a inscricao.`;

    const enviado = await enviarWhatsApp(supabase, inscricao.igreja_id, telefone, mensagem);
    if (!enviado) continue;

    await supabase
      .from("inscricoes_eventos")
      .update({ lembrete_pagamento_em: now.toISOString() })
      .eq("id", inscricao.id);

    lembretesEnviados++;
  }

  const { data: pendentesCancelar, error: cancelarError } = await supabase
    .from("inscricoes_eventos")
    .select(
      `
      id,
      created_at,
      pessoa_id,
      evento_id,
      igreja_id,
      pessoa:profiles!inscricoes_eventos_pessoa_id_fkey (nome, telefone),
      evento:eventos!inscricoes_eventos_evento_id_fkey (titulo, requer_pagamento, status)
      `
    )
    .eq("status_pagamento", "pendente")
    .is("cancelado_em", null)
    .lte("created_at", cancelIso);

  if (cancelarError) {
    console.error("Erro ao buscar pendentes para cancelar:", cancelarError);
  }

  let canceladas = 0;
  for (const inscricao of pendentesCancelar || []) {
    if (!inscricao.evento?.requer_pagamento || inscricao.evento?.status === "cancelado") {
      continue;
    }

    const { error: updateError } = await supabase
      .from("inscricoes_eventos")
      .update({
        status_pagamento: "cancelado",
        cancelado_em: now.toISOString(),
      })
      .eq("id", inscricao.id)
      .eq("status_pagamento", "pendente");

    if (updateError) {
      console.error("Erro ao cancelar inscricao:", updateError);
      continue;
    }

    const telefone = inscricao.pessoa?.telefone;
    if (telefone && inscricao.igreja_id) {
      const mensagem = `Sua inscricao foi cancelada por falta de pagamento. Se ainda desejar participar, faca uma nova inscricao se houver vagas.`;
      await enviarWhatsApp(supabase, inscricao.igreja_id, telefone, mensagem);
    }

    canceladas++;
  }

  await supabase.rpc("log_edge_function_execution", {
    p_function_name: "inscricoes-lembretes",
    p_status: "success",
    p_details: JSON.stringify({ lembretesEnviados, canceladas }),
  });

  return new Response(
    JSON.stringify({ success: true, lembretesEnviados, canceladas }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
