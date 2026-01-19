import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CheckinRequest = {
  qr_token?: string;
  inscricao_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, message: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData?.user) {
    return new Response(JSON.stringify({ success: false, message: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload: CheckinRequest;
  try {
    payload = (await req.json()) as CheckinRequest;
  } catch (error) {
    return new Response(JSON.stringify({ success: false, message: "Invalid JSON" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const qrToken = payload.qr_token?.trim();
  const inscricaoId = payload.inscricao_id?.trim();

  if (!qrToken && !inscricaoId) {
    return new Response(JSON.stringify({ success: false, message: "qr_token or inscricao_id is required" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: inscricao, error: inscricaoError } = await supabase
    .from("inscricoes_eventos")
    .select(
      `
      id,
      evento_id,
      pessoa_id,
      status_pagamento,
      checkin_validado_em,
      qr_token,
      pessoa:profiles!inscricoes_eventos_pessoa_id_fkey (id, nome, email, telefone),
      evento:eventos!inscricoes_eventos_evento_id_fkey (id, titulo, data_evento, status, requer_pagamento)
      `
    )
    .eq(qrToken ? "qr_token" : "id", qrToken ?? inscricaoId)
    .maybeSingle();

  if (inscricaoError || !inscricao) {
    return new Response(JSON.stringify({ success: false, message: "Inscrição não encontrada" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Handle evento as potentially array from join
  const evento = Array.isArray(inscricao.evento) ? inscricao.evento[0] : inscricao.evento;
  const pessoa = Array.isArray(inscricao.pessoa) ? inscricao.pessoa[0] : inscricao.pessoa;

  if (inscricao.checkin_validado_em) {
    return new Response(
      JSON.stringify({
        success: false,
        code: "ALREADY_USED",
        message: "Inscrição já utilizada",
        pessoa,
        evento,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
    );
  }

  if (evento?.status === "cancelado") {
    return new Response(JSON.stringify({ success: false, message: "Evento cancelado" }), {
      status: 409,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (evento?.requer_pagamento) {
    const statusPagamento = inscricao.status_pagamento?.toLowerCase();
    if (statusPagamento !== "pago" && statusPagamento !== "isento") {
      return new Response(
        JSON.stringify({
          success: false,
          code: "PENDENTE",
          message: "Pagamento pendente",
          pessoa,
          evento,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
      );
    }
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateError } = await supabase
    .from("inscricoes_eventos")
    .update({
      checkin_validado_em: now,
      checkin_validado_por: authData.user.id,
    })
    .eq("id", inscricao.id)
    .is("checkin_validado_em", null)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return new Response(JSON.stringify({ success: false, message: "Erro ao validar inscrição" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!updated) {
    return new Response(
      JSON.stringify({
        success: false,
        code: "ALREADY_USED",
        message: "Inscrição já utilizada",
        pessoa,
        evento,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 409 }
    );
  }

  const { error: checkinError } = await supabase
    .from("checkins")
    .insert({
      evento_id: inscricao.evento_id,
      pessoa_id: inscricao.pessoa_id,
      metodo: "inscricao_qr",
      validado_por: authData.user.id,
      tipo_registro: "inscricao",
    });

  if (checkinError) {
    await supabase
      .from("inscricoes_eventos")
      .update({ checkin_validado_em: null, checkin_validado_por: null })
      .eq("id", inscricao.id)
      .eq("checkin_validado_em", now)
      .eq("checkin_validado_por", authData.user.id);

    return new Response(JSON.stringify({ success: false, message: "Erro ao registrar presença" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      success: true,
      message: "Check-in confirmado",
      pessoa,
      evento,
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});
