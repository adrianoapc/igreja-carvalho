import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { credentialId, userId } = await req.json();

    if (!credentialId || !userId) {
      return new Response(
        JSON.stringify({ error: "credentialId e userId são obrigatórios" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Criar cliente Supabase com service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verificar se o credential_id existe e pertence ao user_id
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("user_id, biometric_credential_id")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ error: "Perfil de usuário não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Verificar se o credential_id armazenado corresponde ao fornecido
    if (profile.biometric_credential_id !== credentialId) {
      return new Response(
        JSON.stringify({
          error: "Credencial biométrica não corresponde ao usuário",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Criar uma sessão customizada
    // NOTA: Supabase não permite criar sessões arbitrariamente via admin API
    // A solução é usar um token JWT ou fazer login com um método especial

    // Alternativa 1: Usar um refresh token pré-armazenado
    // Alternativa 2: Criar um token JWT customizado
    // Alternativa 3: Fazer login como admin e retornar a sessão

    // Por enquanto, retornar sucesso para o frontend
    // O frontend precisará fazer um POST para /auth/v1/verify
    // ou usar outra estratégia de autenticação

    return new Response(
      JSON.stringify({
        success: true,
        userId: profile.user_id,
        message: "Biometria verificada com sucesso",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
