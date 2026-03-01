import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { telefone, codigo, nova_senha } = await req.json();

    if (!telefone || !codigo || !nova_senha) {
      return new Response(
        JSON.stringify({ error: "Campos obrigatórios: telefone, codigo, nova_senha" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (nova_senha.length < 6) {
      return new Response(
        JSON.stringify({ error: "A senha deve ter pelo menos 6 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Limpar telefone (apenas dígitos)
    const telefoneLimpo = telefone.replace(/\D/g, "");

    // Buscar OTP válido
    const { data: otp, error: otpError } = await supabase
      .from("otp_verificacao")
      .select("*")
      .eq("telefone", telefoneLimpo)
      .eq("codigo", codigo)
      .eq("usado", false)
      .gt("expira_em", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (otpError) {
      console.error("Erro ao buscar OTP:", otpError);
      return new Response(
        JSON.stringify({ error: "Erro ao verificar código" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!otp) {
      return new Response(
        JSON.stringify({ error: "Código inválido, expirado ou já utilizado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar tentativas
    if (otp.tentativas >= 5) {
      await supabase
        .from("otp_verificacao")
        .update({ usado: true })
        .eq("id", otp.id);

      return new Response(
        JSON.stringify({ error: "Número máximo de tentativas excedido. Solicite um novo código." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Incrementar tentativas
    await supabase
      .from("otp_verificacao")
      .update({ tentativas: otp.tentativas + 1 })
      .eq("id", otp.id);

    // Buscar user_id do profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("id", otp.profile_id)
      .single();

    if (profileError || !profile?.user_id) {
      return new Response(
        JSON.stringify({ error: "Perfil ou usuário não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Atualizar senha via Admin API
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      profile.user_id,
      { password: nova_senha }
    );

    if (updateError) {
      console.error("Erro ao atualizar senha:", updateError);
      return new Response(
        JSON.stringify({ error: updateError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Marcar OTP como usado
    await supabase
      .from("otp_verificacao")
      .update({ usado: true })
      .eq("id", otp.id);

    // Limpar flag deve_trocar_senha
    await supabase
      .from("profiles")
      .update({ deve_trocar_senha: false, updated_at: new Date().toISOString() })
      .eq("id", otp.profile_id);

    return new Response(
      JSON.stringify({ success: true, message: "Senha definida com sucesso" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro não tratado:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
