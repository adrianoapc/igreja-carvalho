import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TENTATIVAS = 5;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { telefone, codigo } = await req.json();

    if (!telefone || !codigo) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: telefone, codigo" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const telefoneLimpo = telefone.replace(/\D/g, "");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar o OTP mais recente não expirado para o telefone
    const { data: otp, error: otpError } = await supabase
      .from("otp_verificacao")
      .select("*")
      .eq("telefone", telefoneLimpo)
      .eq("tipo", "whatsapp")
      .eq("usado", false)
      .gt("expira_em", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("[verify-otp] Erro ao buscar OTP:", otpError);
      return new Response(JSON.stringify({ error: "Erro ao verificar código" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!otp) {
      return new Response(
        JSON.stringify({ error: "Código inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Bloquear se excedeu tentativas (verificar antes de comparar código)
    if (otp.tentativas >= MAX_TENTATIVAS) {
      await supabase
        .from("otp_verificacao")
        .update({ usado: true })
        .eq("id", otp.id);

      return new Response(
        JSON.stringify({
          error: "Número máximo de tentativas excedido. Solicite um novo código.",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Incrementar tentativas antes de checar o código (proteção contra timing/brute-force)
    await supabase
      .from("otp_verificacao")
      .update({ tentativas: otp.tentativas + 1 })
      .eq("id", otp.id);

    if (otp.codigo !== String(codigo).trim()) {
      const restantes = MAX_TENTATIVAS - (otp.tentativas + 1);
      return new Response(
        JSON.stringify({
          error: "Código incorreto",
          tentativas_restantes: restantes > 0 ? restantes : 0,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Código correto — marcar como usado
    await supabase
      .from("otp_verificacao")
      .update({ usado: true })
      .eq("id", otp.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Código verificado com sucesso",
        profile_id: otp.profile_id ?? null,
        igreja_id: otp.igreja_id ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[verify-otp] Erro não tratado:", err);
    return new Response(JSON.stringify({ error: "Erro interno do servidor" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
