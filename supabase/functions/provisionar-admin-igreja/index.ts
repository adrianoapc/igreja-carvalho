import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Função para gerar senha aleatória segura
function generateSecurePassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  
  // Garantir pelo menos um de cada tipo
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)]; // Maiúscula
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)]; // Minúscula  
  password += "0123456789"[Math.floor(Math.random() * 10)]; // Número
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)]; // Especial
  
  // Preencher o resto aleatoriamente
  for (let i = 4; i < 16; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // Embaralhar a senha
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, nome, igreja_id, filial_id } = await req.json();

    if (!email || !nome || !igreja_id) {
      return new Response(
        JSON.stringify({ error: "Email, nome e igreja_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gerar senha segura aleatória
    const tempPassword = generateSecurePassword();

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // 1. Create auth user with temporary password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password: tempPassword,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        nome,
      },
      app_metadata: {
        igreja_id,
        filial_id,
      },
    });

    if (authError) {
      console.error("Erro ao criar usuário auth:", authError);
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userId = authData.user.id;

    // 2. Create profile with admin data and flag to change password
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        user_id: userId,
        nome: nome.trim(),
        email: email.toLowerCase().trim(),
        status: "membro",
        igreja_id,
        filial_id,
        deve_trocar_senha: true,
        observacoes: `Admin criado automaticamente ao cadastrar igreja. Senha temporária gerada automaticamente - deve ser alterada no primeiro login.`,
      })
      .select()
      .single();

    if (profileError) {
      console.error("Erro ao criar profile:", profileError);
      // Rollback - delete auth user
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Erro ao criar perfil: ${profileError.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Assign admin_igreja role
    const { error: roleError } = await supabaseAdmin
      .from("user_roles")
      .insert({
        user_id: userId,
        role: "admin_igreja",
      });

    if (roleError) {
      console.error("Erro ao atribuir role:", roleError);
      // Continue anyway, admin can fix later
    }

    console.log(`Admin provisionado com sucesso: ${email} para igreja ${igreja_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Admin criado com sucesso",
        profile_id: profile.id,
        user_id: userId,
        temp_password: tempPassword,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Erro inesperado:", error);
    const message = error instanceof Error ? error.message : "Erro interno";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
