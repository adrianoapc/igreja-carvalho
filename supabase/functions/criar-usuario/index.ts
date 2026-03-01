// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Gerar OTP de 6 dígitos
function gerarOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Salvar OTP no banco e disparar via WhatsApp
async function criarEEnviarOTP(
  supabase: any,
  profileId: string,
  telefone: string,
  igrejaId: string | null,
  nome: string,
  tipo: string
): Promise<{ success: boolean; error?: string }> {
  const codigo = gerarOTP();
  const expiraEm = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

  // Limpar telefone
  const telefoneLimpo = telefone.replace(/\D/g, "");

  // Salvar OTP
  const { error: otpError } = await supabase.from("otp_verificacao").insert({
    profile_id: profileId,
    codigo,
    tipo,
    telefone: telefoneLimpo,
    igreja_id: igrejaId,
    expira_em: expiraEm,
  });

  if (otpError) {
    console.error("Erro ao salvar OTP:", otpError);
    return { success: false, error: "Erro ao gerar código de verificação" };
  }

  // Disparar via disparar-alerta
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const alertaPayload = {
      evento: "otp_verificacao",
      dados: {
        igreja_id: igrejaId,
        telefone: telefoneLimpo,
        nome: nome,
        mensagem: `Olá ${nome}, seu código de verificação é: ${codigo}. Válido por 10 minutos.`,
        template: "otp_verificacao",
      },
    };

    const alertaResponse = await fetch(
      `${supabaseUrl}/functions/v1/disparar-alerta`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify(alertaPayload),
      }
    );

    if (!alertaResponse.ok) {
      const body = await alertaResponse.text();
      console.warn("Aviso: disparar-alerta retornou erro:", body);
      // Não falhar por causa do alerta - OTP foi salvo
    } else {
      console.log("✅ OTP enviado via disparar-alerta");
    }
  } catch (alertaError) {
    console.warn("Aviso: falha ao chamar disparar-alerta:", alertaError);
  }

  return { success: true };
}

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

    const authHeader = req.headers.get("authorization");

    const payload = await req.json();
    const { action, profile_id, email, password, telefone } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Environment variables not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ========== CRIAR USUÁRIO ==========
    if (action === "create_user") {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authorization header missing" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!email || !password || !profile_id) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: email, password, profile_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        // Criar usuário via Admin API
        const { data: user, error: createError } =
          await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: false,
          });

        if (createError) {
          console.error("Erro ao criar usuário:", createError);
          return new Response(
            JSON.stringify({ error: createError.message, success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Atualizar profile com o user_id
        const { error: updateError } = await supabase
          .from("profiles")
          .update({
            user_id: user.user.id,
            deve_trocar_senha: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile_id);

        if (updateError) {
          console.error("Erro ao atualizar profile:", updateError);
          return new Response(
            JSON.stringify({
              error: `Usuário criado mas não foi possível atualizar o perfil: ${updateError.message}`,
              success: false,
            }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Buscar dados da pessoa para enviar OTP
        const { data: profileData } = await supabase
          .from("profiles")
          .select("telefone, nome, igreja_id")
          .eq("id", profile_id)
          .single();

        const pessoaTelefone = payload.telefone || profileData?.telefone;
        const pessoaNome = payload.nome || profileData?.nome || "Usuário";
        const pessoaIgrejaId = payload.igreja_id || profileData?.igreja_id;

        // Se tem telefone, enviar OTP via WhatsApp
        if (pessoaTelefone) {
          const otpResult = await criarEEnviarOTP(
            supabase,
            profile_id,
            pessoaTelefone,
            pessoaIgrejaId,
            pessoaNome,
            "criar_senha"
          );

          return new Response(
            JSON.stringify({
              success: true,
              user_id: user.user.id,
              otp_enviado: otpResult.success,
              message: otpResult.success
                ? "Usuário criado e código enviado via WhatsApp"
                : "Usuário criado mas falha ao enviar código",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Sem telefone - fallback (senha já definida)
        return new Response(
          JSON.stringify({
            success: true,
            user_id: user.user.id,
            otp_enviado: false,
            message: "Usuário criado com sucesso (sem telefone para OTP)",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: unknown) {
        console.error("Exceção ao criar usuário:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        return new Response(
          JSON.stringify({ error: `Erro ao criar usuário: ${errorMessage}`, success: false }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    // ========== RESETAR SENHA ==========
    } else if (action === "reset_password") {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Authorization header missing" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!password || !profile_id) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: password, profile_id" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const { data: profile, error: fetchError } = await supabase
          .from("profiles")
          .select("user_id, telefone, nome, igreja_id")
          .eq("id", profile_id)
          .single();

        if (fetchError || !profile?.user_id) {
          return new Response(
            JSON.stringify({ error: "Profile ou user_id não encontrado", success: false }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Atualizar senha via Admin API
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          profile.user_id,
          { password }
        );

        if (updateError) {
          console.error("Erro ao resetar senha:", updateError);
          return new Response(
            JSON.stringify({ error: updateError.message, success: false }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Marcar profile para trocar senha
        await supabase
          .from("profiles")
          .update({ deve_trocar_senha: true, updated_at: new Date().toISOString() })
          .eq("id", profile_id);

        // Enviar OTP se tem telefone
        const pessoaTelefone = payload.telefone || profile.telefone;
        const pessoaNome = payload.nome || profile.nome || "Usuário";
        const pessoaIgrejaId = payload.igreja_id || profile.igreja_id;

        if (pessoaTelefone) {
          const otpResult = await criarEEnviarOTP(
            supabase,
            profile_id,
            pessoaTelefone,
            pessoaIgrejaId,
            pessoaNome,
            "resetar_senha"
          );

          return new Response(
            JSON.stringify({
              success: true,
              otp_enviado: otpResult.success,
              message: otpResult.success
                ? "Senha resetada e código enviado via WhatsApp"
                : "Senha resetada mas falha ao enviar código",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({
            success: true,
            otp_enviado: false,
            message: "Senha resetada com sucesso (sem telefone para OTP)",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: unknown) {
        console.error("Exceção ao resetar senha:", error);
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        return new Response(
          JSON.stringify({ error: `Erro ao resetar senha: ${errorMessage}`, success: false }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    // ========== RECUPERAÇÃO VIA WHATSAPP (público) ==========
    } else if (action === "recovery_otp") {
      if (!telefone) {
        return new Response(
          JSON.stringify({ error: "Telefone é obrigatório" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      try {
        const telefoneLimpo = telefone.replace(/\D/g, "");

        // Buscar profile pelo telefone
        const { data: profiles, error: searchError } = await supabase
          .from("profiles")
          .select("id, nome, user_id, igreja_id, telefone")
          .or(`telefone.eq.${telefoneLimpo},telefone.like.%${telefoneLimpo.slice(-9)}%`)
          .not("user_id", "is", null)
          .limit(1);

        if (searchError) {
          console.error("Erro ao buscar profile:", searchError);
          return new Response(
            JSON.stringify({ error: "Erro ao buscar perfil" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!profiles || profiles.length === 0) {
          // Retornar sucesso genérico por segurança (não revelar se telefone existe)
          return new Response(
            JSON.stringify({
              success: true,
              message: "Se o telefone estiver cadastrado, um código será enviado via WhatsApp.",
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const profile = profiles[0];

        // Gerar senha temporária interna (necessária para reset)
        const senhaInterna = crypto.randomUUID().slice(0, 16);
        await supabase.auth.admin.updateUserById(profile.user_id, {
          password: senhaInterna,
        });

        await supabase
          .from("profiles")
          .update({ deve_trocar_senha: true, updated_at: new Date().toISOString() })
          .eq("id", profile.id);

        // Enviar OTP
        await criarEEnviarOTP(
          supabase,
          profile.id,
          telefoneLimpo,
          profile.igreja_id,
          profile.nome || "Usuário",
          "recuperar_senha"
        );

        return new Response(
          JSON.stringify({
            success: true,
            message: "Se o telefone estiver cadastrado, um código será enviado via WhatsApp.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (error: unknown) {
        console.error("Exceção na recuperação:", error);
        return new Response(
          JSON.stringify({ error: "Erro interno" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("Erro não tratado:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
