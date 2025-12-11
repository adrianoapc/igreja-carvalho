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
  evento_slug: string;
  role_alvo?: string | null;
  user_id_especifico?: string | null;
  canais?: {
    in_app?: boolean;
    push?: boolean;
    whatsapp?: boolean;
    whatsapp_provider?: string;
    template_meta?: string;
  } | null;
  ativo?: boolean;
}

interface NotificacaoEvento {
  slug: string;
  nome: string;
  categoria: string;
  provider_preferencial?: string | null;
  template_meta?: string | null;
  variaveis?: string[] | null;
}

interface ProfileComRoles {
  id: string;
  nome: string;
  email: string;
  telefone?: string | null;
  avatar_url?: string | null;
}

// Formatar string com variáveis do tipo {{chave}}
function formatarTemplate(template: string, dados: Record<string, any>): string {
  return template.replace(/{{(\w+)}}/g, (match, chave) => {
    return dados[chave] ?? match;
  });
}

// Buscar regras para o evento
async function buscarRegras(
  supabase: any,
  eventoSlug: string
): Promise<NotificacaoRegra[]> {
  const { data, error } = await supabase
    .from("notificacao_regras")
    .select("*")
    .eq("evento_slug", eventoSlug)
    .eq("ativo", true);

  if (error) {
    console.error("Erro ao buscar regras:", error);
    return [];
  }

  return (data as NotificacaoRegra[]) || [];
}

// Buscar evento config
async function buscarEvento(
  supabase: any,
  eventoSlug: string
): Promise<NotificacaoEvento | null> {
  const { data, error } = await supabase
    .from("notificacao_eventos")
    .select("*")
    .eq("slug", eventoSlug)
    .maybeSingle();

  if (error) {
    console.error("Erro ao buscar evento:", error);
    return null;
  }

  return data as NotificacaoEvento | null;
}

// Buscar usuários por role
async function buscarUsuariosPorRole(
  supabase: any,
  role: string
): Promise<ProfileComRoles[]> {
  // Tabela legada
  const { data: roleUsers, error: roleError } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("role", role);

  // Tabela nova (user_app_roles), se existir
  const { data: appRoles, error: appRoleError } = await supabase
    .from("user_app_roles")
    .select("user_id")
    .eq("role", role);

  if (roleError) {
    console.error(`Erro ao buscar usuários com role ${role} (user_roles):`, roleError);
  }

  if (appRoleError) {
    console.error(`Erro ao buscar usuários com role ${role} (user_app_roles):`, appRoleError);
  }

  const userIds = [
    ...(roleUsers?.map((r: any) => r.user_id) || []),
    ...(appRoles?.map((r: any) => r.user_id) || []),
  ];

  if (userIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, nome, email, telefone, avatar_url")
    .in("user_id", userIds);

  if (profileError) {
    console.error("Erro ao buscar perfis:", profileError);
    return [];
  }

  return (profiles as ProfileComRoles[]) || [];
}

// Buscar usuário específico
async function buscarUsuario(
  supabase: any,
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

  return data as ProfileComRoles | null;
}

// Disparar notificação in-app
async function dispararInApp(
  supabase: any,
  userId: string,
  titulo: string,
  mensagem: string,
  evento: string
): Promise<boolean> {
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    title: titulo,
    message: mensagem,
    type: evento,
    read: false,
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
  evento: string,
  provider: string | null,
  templateMeta?: string | null
): Promise<boolean> {
  if (!telefone) {
    console.warn("Telefone não disponível, pulando WhatsApp");
    return false;
  }

  const providerPref = provider || "make";

  // Rota Make (webhook)
  if (providerPref === "make") {
    const MAKE_WEBHOOK_URL = Deno.env.get("MAKE_WEBHOOK_URL");
    if (!MAKE_WEBHOOK_URL) {
      console.warn("MAKE_WEBHOOK_URL não configurada, pulando WhatsApp via Make");
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
        console.error(`Erro ao disparar WhatsApp (Make): ${response.statusText}`);
        return false;
      }

      console.log(`✅ WhatsApp (Make) disparado para ${telefone}`);
      return true;
    } catch (error) {
      console.error("Erro ao chamar webhook Make:", error);
      return false;
    }
  }

  // Rota Meta Cloud API (direto)
  if (providerPref === "meta_direto") {
    const META_WA_URL = Deno.env.get("META_WA_URL");
    const META_WA_TOKEN = Deno.env.get("META_WA_TOKEN");
    const templateName = templateMeta || evento;

    if (!META_WA_URL || !META_WA_TOKEN) {
      console.warn("META_WA_URL ou META_WA_TOKEN não configurados, pulando Meta direto");
      return false;
    }

    try {
      const payload = {
        to: telefone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "pt_BR" },
          components: [
            {
              type: "body",
              parameters: [{ type: "text", text: mensagem.slice(0, 1024) }],
            },
          ],
        },
      };

      const response = await fetch(META_WA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${META_WA_TOKEN}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`Erro ao disparar WhatsApp (Meta): ${response.status} - ${body}`);
        return false;
      }

      console.log(`✅ WhatsApp (Meta) disparado para ${telefone} via template ${templateName}`);
      return true;
    } catch (error) {
      console.error("Erro ao chamar Meta API:", error);
      return false;
    }
  }

  console.warn(`Provider WhatsApp desconhecido: ${providerPref}`);
  return false;
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

    // Buscar configuração do evento
    const eventoCfg = await buscarEvento(supabase, evento);
    const providerPreferencial = eventoCfg?.provider_preferencial || "make";

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
      } else if (regra.user_id_especifico) {
        const usuario = await buscarUsuario(supabase, regra.user_id_especifico);
        if (usuario) destinatarios = [usuario];
      } else if (regra.role_alvo) {
        destinatarios = await buscarUsuariosPorRole(supabase, regra.role_alvo);
      }

      if (destinatarios.length === 0) {
        console.warn(`⚠️  Nenhum destinatário encontrado para regra ${regra.id}`);
        continue;
      }

      console.log(`👥 ${destinatarios.length} destinatário(s) encontrado(s)`);
      totalDestinatarios += destinatarios.length;

      // Formatar título e mensagem usando dados e nome do evento
      const titulo = eventoCfg?.nome || evento;
      const mensagem = formatarTemplate(
        `Evento: ${eventoCfg?.nome || evento}. ${JSON.stringify(dados)}`,
        dados
      );

      // Canais (json) com defaults
      const canais = regra.canais || {};
      const usarInApp = canais.in_app ?? true;
      const usarWhatsApp = canais.whatsapp ?? false;
      const usarPush = canais.push ?? false;
      const providerWhats = canais.whatsapp_provider || providerPreferencial || "make";
      const templateMeta = canais.template_meta || eventoCfg?.template_meta || null;

      // Disparar por cada destinatário e canal
      for (const destinatario of destinatarios) {
        console.log(`   → Enviando para ${destinatario.nome} (${destinatario.id})`);

        // Canal In-App
        if (usarInApp) {
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
        if (usarWhatsApp && destinatario.telefone) {
          const sucesso = await dispararWhatsApp(
            destinatario.telefone,
            mensagem,
            evento,
            providerWhats,
            templateMeta
          );
          if (sucesso) totalNotificacoes++;
        }

        // Canal Push (placeholder)
        if (usarPush) {
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
