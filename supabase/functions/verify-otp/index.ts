import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_TENTATIVAS = 5;

async function hashCodigo(codigo: string): Promise<string> {
  const data = new TextEncoder().encode(codigo);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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
    const hashInformado = await hashCodigo(String(codigo).trim());

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Buscar OTP mais recente não expirado e não usado para o número
    const { data: otp, error: otpError } = await supabase
      .from("otp_verificacao")
      .select("id, codigo_hash, tentativas, profile_id, igreja_id")
      .eq("telefone", telefoneLimpo)
      .eq("tipo", "whatsapp")
      .eq("usado", false)
      .not("codigo_hash", "is", null)
      .gt("expira_em", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("[verify-otp] Erro ao buscar OTP:", otpError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar código" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!otp) {
      return new Response(
        JSON.stringify({ error: "Código inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Bloquear se já excedeu o limite de tentativas
    if (otp.tentativas >= MAX_TENTATIVAS) {
      await supabase
        .from("otp_verificacao")
        .update({ usado: true })
        .eq("id", otp.id);

      return new Response(
        JSON.stringify({ error: "Número máximo de tentativas excedido. Solicite um novo código." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Incrementar tentativas ANTES de comparar (proteção contra brute-force por timing)
    await supabase
      .from("otp_verificacao")
      .update({ tentativas: otp.tentativas + 1 })
      .eq("id", otp.id);

    if (otp.codigo_hash !== hashInformado) {
      const restantes = MAX_TENTATIVAS - (otp.tentativas + 1);
      return new Response(
        JSON.stringify({
          error: "Código incorreto",
          tentativas_restantes: Math.max(0, restantes),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Código correto — invalidar OTP
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
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
