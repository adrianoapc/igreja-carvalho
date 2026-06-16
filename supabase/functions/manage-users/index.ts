// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Edge Function para criar usuários
// Usa a API de Admin do Supabase para criar usuários de forma segura

// Headers CORS para todas as respostas
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Lidar com preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Apenas POST permitido
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar autorização (Bearer token)
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Authorization header missing" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload = await req.json();
    const { action, profile_id, email, password } = payload;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      return new Response(
        JSON.stringify({ error: "Environment variables not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validar JWT do chamador
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "Não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Exigir role admin/admin_igreja/super_admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const allowed = new Set(["admin", "admin_igreja", "super_admin"]);
    if (!roles?.some((r: any) => allowed.has(r.role))) {
      return new Response(
        JSON.stringify({ error: "Permissão insuficiente" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Enforce same-church on target profile (super_admin exempt)
    if (profile_id && !roles.some((r: any) => r.role === "super_admin")) {
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("igreja_id")
        .eq("user_id", user.id)
        .maybeSingle();
      const { data: targetProfile } = await supabase
        .from("profiles")
        .select("igreja_id")
        .eq("id", profile_id)
        .maybeSingle();
      if (
        !callerProfile ||
        !targetProfile ||
        callerProfile.igreja_id !== targetProfile.igreja_id
      ) {
        return new Response(
          JSON.stringify({ error: "Perfil não pertence à sua igreja" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (action === "create_user") {
      if (!email || !password || !profile_id) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: email, password, profile_id",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      try {
        // Criar usuário via Admin API
        const { data: user, error: createError } =
          await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
          });

        if (createError) {
          console.error("Erro ao criar usuário:", createError);
          return new Response(
            JSON.stringify({ error: createError.message, success: false }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
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
          // Tentar deletar o usuário criado para manter consistência
          await supabase.auth.admin.deleteUser(user.user.id);
          return new Response(
            JSON.stringify({
              error: `Não foi possível vincular o usuário ao perfil: ${updateError.message}`,
              success: false,
            }),
            {
              status: 500,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Atribuir role "membro" ao novo usuário
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: user.user.id,
            role: "membro",
          });

        if (roleError) {
          console.warn("Aviso: Não foi possível atribuir role membro:", roleError);
          // Não falha a operação, apenas loga o aviso
        }

        console.log(`Usuário criado com sucesso: ${email} -> ${user.user.id}`);

        return new Response(
          JSON.stringify({
            success: true,
            user_id: user.user.id,
            message: "Usuário criado com sucesso",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        console.error("Exceção ao criar usuário:", error);
        return new Response(
          JSON.stringify({
            error: `Erro ao criar usuário: ${error.message}`,
            success: false,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    } else if (action === "reset_password") {
      if (!password || !profile_id) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields: password, profile_id",
          }),
          {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      try {
        // Obter user_id do profile
        const { data: profile, error: fetchError } = await supabase
          .from("profiles")
          .select("user_id, nome")
          .eq("id", profile_id)
          .single();

        if (fetchError || !profile?.user_id) {
          return new Response(
            JSON.stringify({
              error: "Profile ou user_id não encontrado",
              success: false,
            }),
            {
              status: 404,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
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
            JSON.stringify({
              error: updateError.message,
              success: false,
            }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Marcar profile para trocar senha no próximo login
        await supabase
          .from("profiles")
          .update({
            deve_trocar_senha: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile_id);

        console.log(`Senha resetada para: ${profile.nome} (${profile_id})`);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Senha resetada com sucesso",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      } catch (error: any) {
        console.error("Exceção ao resetar senha:", error);
        return new Response(
          JSON.stringify({
            error: `Erro ao resetar senha: ${error.message}`,
            success: false,
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
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
