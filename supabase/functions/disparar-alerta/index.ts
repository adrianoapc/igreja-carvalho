import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DisparadorPayload {
  evento: string;
  dados: Record<string, any>;
  user_id_alvo?: string;
}

interface NotificacaoRegra {
  id: string;
  evento: string;
  titulo_template: string;
  mensagem_template: string;
  role_destinatario?: string;
  canal_inapp: boolean;
  canal_whatsapp: boolean;
  canal_push: boolean;
}

interface ProfileComRoles {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  avatar_url?: string;
}

// Formatar string com variáveis do tipo {{chave}}
function formatarTemplate(template: string, dados: Record<string, any>): string {
  return template.replace(/{{(\w+)}}/g, (match, chave) => {
    return dados[chave] ?? match;
  });
}

// Buscar regras para o evento
async function buscarRegras(
  supabase: ReturnType<typeof createClient>,
  evento: string
): Promise<NotificacaoRegra[]> {
  const { data, error } = await supabase
    .from("notificacao_regras")
    .select("*")
    .eq("evento", evento);

  if (error) {
    console.error("Erro ao buscar regras:", error);
    return [];
  }

  return data || [];
}

// Buscar usuários por role
async function buscarUsuariosPorRole(
  supabase: ReturnType<typeof createClient>,
  role: string
): Promise<ProfileComRoles[]> {
  const { data: roleUsers, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", role);

  if (roleError) {
    console.error(`Erro ao buscar usuários com role ${role}:`, roleError);
    return [];
  }

  if (!roleUsers || roleUsers.length === 0) {
    return [];
  }

  const userIds = roleUsers.map((r) => r.user_id);

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, nome, email, telefone, avatar_url")
    .in("id", userIds);

  if (profileError) {
    console.error("Erro ao buscar perfis:", profileError);
    return [];
  }

  return profiles || [];
}

// Buscar usuário específico
async function buscarUsuario(
  supabase: ReturnType<typeof createClient>,
  userId: string
): Promise<ProfileComRoles | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, email, telefone, avatar_url")
    .eq("id", userId)
    .single();

  if (error) {
    console.error("Erro ao buscar usuário:", error);
    return null;
  }

  return data;
}

// Disparar notificação in-app
async function dispararInApp(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  titulo: string,
  mensagem: string,
  evento: string
): Promise<boolean> {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    titulo,
    mensagem,
    tipo: evento,
    lido: false,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error(`Erro ao disparar in-app para ${userId}:`, error);
    return false;
  }

  console.log(`✅ In-App disparado para ${userId}`);
  return true;
}

// Disparar notificação via WhatsApp (Make webhook)
async function dispararWhatsApp(
  telefone: string,
  mensagem: string,
  evento: string
): Promise<boolean> {
  const MAKE_WEBHOOK_URL = Deno.env.get("MAKE_WEBHOOK_URL");

  if (!MAKE_WEBHOOK_URL) {
    console.warn("MAKE_WEBHOOK_URL não configurada, pulando WhatsApp");
    return false;
  }

  if (!telefone) {
    console.warn("Telefone não disponível, pulando WhatsApp");
    return false;
  }

  try {
    const payload = {
      telefone,
      mensagem,
      template: evento,
      timestamp: new Date().toISOString(),
    };

    const response = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Erro ao disparar WhatsApp: ${response.statusText}`);
      return false;
    }

    console.log(`✅ WhatsApp disparado para ${telefone}`);
    return true;
  } catch (error) {
    console.error("Erro ao chamar Make webhook:", error);
    return false;
  }
}

// Disparar notificação push (placeholder para futuro)
async function dispararPush(
  userId: string,
  titulo: string,
  mensagem: string,
  evento: string
): Promise<boolean> {
  console.log(
    `📱 [PLACEHOLDER] Push deveria ser disparado para ${userId}: "${titulo}" - "${mensagem}"`
  );
  console.log(
    `   Implementar integração com OneSignal/Expo para evento: ${evento}`
  );
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: DisparadorPayload = await req.json();
    const { evento, dados, user_id_alvo } = payload;

    if (!evento) {
      return new Response(
        JSON.stringify({ erro: "Evento é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`🚀 Disparando alerta para evento: ${evento}`);
    console.log(`   Dados: ${JSON.stringify(dados)}`);

    // Criar cliente Supabase com service role (para acessar dados de todos)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar regras para o evento
    const regras = await buscarRegras(supabase, evento);

    if (regras.length === 0) {
      return new Response(
        JSON.stringify({
          sucesso: true,
          mensagem: "Nenhuma regra encontrada para este evento",
          regrasAplicadas: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`📋 Encontradas ${regras.length} regra(s) para ${evento}`);

    let totalDestinatarios = 0;
    let totalNotificacoes = 0;

    // Processar cada regra
    for (const regra of regras) {
      console.log(`\n📌 Processando regra: ${regra.id}`);

      // Determinar destinatários
      let destinatarios: ProfileComRoles[] = [];

      if (user_id_alvo) {
        // Notificação específica para um usuário
        const usuario = await buscarUsuario(supabase, user_id_alvo);
        if (usuario) {
          destinatarios = [usuario];
        }
      } else if (regra.role_destinatario) {
        // Notificação para todos com um role específico
        destinatarios = await buscarUsuariosPorRole(supabase, regra.role_destinatario);
      }

      if (destinatarios.length === 0) {
        console.warn(`⚠️  Nenhum destinatário encontrado para regra ${regra.id}`);
        continue;
      }

      console.log(`👥 ${destinatarios.length} destinatário(s) encontrado(s)`);
      totalDestinatarios += destinatarios.length;

      // Formatar título e mensagem
      const titulo = formatarTemplate(regra.titulo_template, dados);
      const mensagem = formatarTemplate(regra.mensagem_template, dados);

      // Disparar por cada destinatário e canal
      for (const destinatario of destinatarios) {
        console.log(`   → Enviando para ${destinatario.nome} (${destinatario.id})`);

        // Canal In-App
        if (regra.canal_inapp) {
          const sucesso = await dispararInApp(
            supabase,
            destinatario.id,
            titulo,
            mensagem,
            evento
          );
          if (sucesso) totalNotificacoes++;
        }

        // Canal WhatsApp
        if (regra.canal_whatsapp && destinatario.telefone) {
          const sucesso = await dispararWhatsApp(
            destinatario.telefone,
            mensagem,
            evento
          );
          if (sucesso) totalNotificacoes++;
        }

        // Canal Push (placeholder)
        if (regra.canal_push) {
          const sucesso = await dispararPush(
            destinatario.id,
            titulo,
            mensagem,
            evento
          );
          if (sucesso) totalNotificacoes++;
        }
      }
    }

    console.log(
      `\n✨ Alerta concluído: ${totalDestinatarios} destinatário(s), ${totalNotificacoes} notificação(ões) disparada(s)`
    );

    return new Response(
      JSON.stringify({
        sucesso: true,
        evento,
        regrasAplicadas: regras.length,
        destinatariosAlcancados: totalDestinatarios,
        notificacoesDisparadas: totalNotificacoes,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro geral:", error);
    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
