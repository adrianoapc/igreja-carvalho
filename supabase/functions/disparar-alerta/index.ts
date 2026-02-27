import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";
import { getWebhookConfig, getActiveWhatsAppProvider } from "../_shared/secrets.ts";
import { resolverWebhookComRemetente, getActiveWhatsAppProviderWithFallback } from "../_shared/webhook-resolver.ts";
import { formatarParaWhatsApp } from "../_shared/telefone-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// URL base do app para links
const APP_URL = Deno.env.get("APP_URL") || "https://igreja.lovable.app";

interface DisparadorPayload {
  evento: string;
  dados: Record<string, unknown>;
  user_id_alvo?: string;
  // Suporte para webhook de banco (Database Webhook payload)
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
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
function formatarTemplate(template: string, dados: Record<string, unknown>): string {
  return template.replace(/{{(\w+)}}/g, (match, chave: string) => {
    const valor = dados[chave];
    return valor !== undefined && valor !== null ? String(valor) : match;
  });
}

// Buscar regras para o evento
async function buscarRegras(
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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
    ...(roleUsers?.map((r: { user_id: string }) => r.user_id) || []),
    ...(appRoles?.map((r: { user_id: string }) => r.user_id) || []),
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
  supabase: SupabaseClient,
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
  supabase: SupabaseClient,
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

// Disparar notificação via WhatsApp (Multi-tenant com fallback 3 níveis)
async function dispararWhatsAppMultiTenant(
  supabase: SupabaseClient,
  igrejaId: string,
  telefone: string,
  mensagem: string,
  evento: string,
  templateMeta?: string | null,
  filialId?: string | null
): Promise<boolean> {
  if (!telefone) {
    console.warn("Telefone não disponível, pulando WhatsApp");
    return false;
  }

  // Buscar provedor WhatsApp ativo com fallback em 3 níveis
  const provider = await getActiveWhatsAppProviderWithFallback(supabase, igrejaId, filialId || null);
  
  if (!provider) {
    console.warn(`Nenhum provedor WhatsApp configurado (igreja: ${igrejaId}, filial: ${filialId || 'N/A'})`);
    return false;
  }

  const { tipo, resolucao } = provider;
  console.log(`📤 Usando webhook nível: ${resolucao.webhookNivel}`);

  // Rota Make (webhook) - agora inclui remetente no payload
  if (tipo === "whatsapp_make") {
    if (!resolucao.webhookUrl) {
      console.warn("URL do webhook Make não configurada");
      return false;
    }

    try {
      const payload = {
        telefone,
        whatsapp_remetente: resolucao.whatsappRemetente,
        whatsapp_sender_id: resolucao.whatsappSenderId,
        mensagem,
        template: evento,
        webhook_nivel: resolucao.webhookNivel,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(resolucao.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        console.error(`Erro ao disparar WhatsApp (Make): ${response.statusText}`);
        return false;
      }

      console.log(`✅ WhatsApp (Make) disparado para ${telefone} via ${resolucao.webhookNivel}`);
      return true;
    } catch (error) {
      console.error("Erro ao chamar webhook Make:", error);
      return false;
    }
  }

  // Rota Meta Cloud API (direto)
  if (tipo === "whatsapp_meta") {
    if (!config.url || !config.secret) {
      console.warn("Phone Number ID ou Token Meta não configurados");
      return false;
    }

    const templateName = templateMeta || evento;
    const metaUrl = `https://graph.facebook.com/v18.0/${config.url}/messages`;

    try {
      const payload = {
        messaging_product: "whatsapp",
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

      const response = await fetch(metaUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.secret}`,
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

  // Rota Evolution API
  if (tipo === "whatsapp_evolution") {
    if (!config.url || !config.secret) {
      console.warn("Instância ou API Key Evolution não configurados");
      return false;
    }

    const evolutionUrl = `https://api.evolution-api.com/message/sendText/${config.url}`;

    try {
      const payload = {
        number: telefone,
        text: mensagem,
      };

      const response = await fetch(evolutionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: config.secret,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error(`Erro ao disparar WhatsApp (Evolution): ${response.status} - ${body}`);
        return false;
      }

      console.log(`✅ WhatsApp (Evolution) disparado para ${telefone}`);
      return true;
    } catch (error) {
      console.error("Erro ao chamar Evolution API:", error);
      return false;
    }
  }

  console.warn(`Provider WhatsApp desconhecido: ${tipo}`);
  return false;
}

// Wrapper legado para compatibilidade (usa fallback global se igreja não especificada)
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

  // Fallback para webhook global (legado)
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

      console.log(`✅ WhatsApp (Make/Global) disparado para ${telefone}`);
      return true;
    } catch (error) {
      console.error("Erro ao chamar webhook Make:", error);
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

// ============= HANDLERS ESPECÍFICOS POR TABELA =============

interface AtendimentoPastoralRecord {
  id: string;
  pessoa_id?: string | null;
  visitante_id?: string | null;
  pastor_responsavel_id?: string | null;
  gravidade?: string | null;
  origem?: string | null;
  conteudo_original?: string | null;
  motivo_resumo?: string | null;
  status?: string | null;
  created_at?: string | null;
}

// Handler para atendimentos_pastorais
async function handleAtendimentoPastoral(
  supabase: SupabaseClient,
  record: AtendimentoPastoralRecord
): Promise<{ sucesso: boolean; mensagem: string }> {
  console.log(`🏥 Processando alerta de Gabinete Pastoral: ${record.id}`);
  
  // Só dispara para gravidade crítica ou alta
  const gravidadesCriticas = ['critica', 'alta'];
  if (!record.gravidade || !gravidadesCriticas.includes(record.gravidade)) {
    console.log(`   Gravidade "${record.gravidade}" não requer alerta imediato`);
    return { sucesso: true, mensagem: "Gravidade não crítica, alerta ignorado" };
  }

  // 1. Buscar nome da pessoa/visitante
  let nomePessoa = "Pessoa não identificada";
  
  if (record.pessoa_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome")
      .eq("id", record.pessoa_id)
      .single();
    if (profile?.nome) nomePessoa = profile.nome;
  } else if (record.visitante_id) {
    const { data: visitante } = await supabase
      .from("visitantes_leads")
      .select("nome, telefone")
      .eq("id", record.visitante_id)
      .single();
    if (visitante?.nome) {
      nomePessoa = visitante.nome;
    } else if (visitante?.telefone) {
      nomePessoa = `Visitante (${visitante.telefone})`;
    }
  }

  // 2. Determinar destinatário (pastor responsável ou fallback)
  let telefonePastor: string | null = null;
  let pastorNome = "Pastor de Plantão";
  
  if (record.pastor_responsavel_id) {
    const { data: pastor } = await supabase
      .from("profiles")
      .select("nome, telefone")
      .eq("id", record.pastor_responsavel_id)
      .single();
    
    if (pastor) {
      telefonePastor = pastor.telefone;
      pastorNome = pastor.nome || "Pastor Responsável";
    }
  }

  // Fallback: telefone de plantão pastoral
  if (!telefonePastor) {
    telefonePastor = Deno.env.get("TELEFONE_PLANTAO") || null;
    console.log(`   Usando telefone de plantão: ${telefonePastor ? "configurado" : "NÃO CONFIGURADO"}`);
  }

  if (!telefonePastor) {
    console.warn("⚠️ Nenhum telefone disponível para alerta pastoral!");
    return { sucesso: false, mensagem: "Nenhum telefone de pastor disponível" };
  }

  // 3. Formatar mensagem WhatsApp
  const emojiGravidade = record.gravidade === 'critica' ? '🔴' : '🟠';
  const gravidadeLabel = record.gravidade === 'critica' ? 'Crítica' : 'Alta';
  
  const origemLabel = record.origem === 'sentimentos_ia' 
    ? '🤖 Sentimentos (IA)' 
    : record.origem === 'chatbot'
    ? '💬 Chatbot Triagem'
    : '📱 App/Solicitação';

  // Resumir conteúdo se muito longo
  let conteudo = record.conteudo_original || record.motivo_resumo || "Sem detalhes";
  if (conteudo.length > 200) {
    conteudo = conteudo.substring(0, 197) + "...";
  }

  const linkProntuario = `${APP_URL}/gabinete/atendimento/${record.id}`;

  const mensagem = `🚨 *Alerta de Gabinete Pastoral*

${emojiGravidade} *Gravidade:* ${gravidadeLabel}
📍 *Origem:* ${origemLabel}
👤 *Quem:* ${nomePessoa}

📝 *Motivo:*
${conteudo}

🔗 *Acessar Prontuário:*
${linkProntuario}`;

  // 4. Disparar WhatsApp
  const sucesso = await dispararWhatsApp(
    telefonePastor,
    mensagem,
    "alerta_gabinete_pastoral",
    "make",
    null
  );

  if (sucesso) {
    console.log(`✅ Alerta pastoral enviado para ${pastorNome} (${telefonePastor})`);
    
    // Também criar notificação in-app para o pastor se tiver user_id
    if (record.pastor_responsavel_id) {
      const { data: pastorProfile } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("id", record.pastor_responsavel_id)
        .single();
      
      if (pastorProfile?.user_id) {
        await dispararInApp(
          supabase,
          pastorProfile.user_id,
          `🚨 Atendimento ${gravidadeLabel}`,
          `${nomePessoa} precisa de atenção pastoral urgente.`,
          "alerta_gabinete_pastoral"
        );
      }
    }
  }

  return { 
    sucesso, 
    mensagem: sucesso ? "Alerta pastoral enviado" : "Falha ao enviar alerta" 
  };
}

// Detectar se é um webhook de banco de dados
function isDbWebhook(payload: DisparadorPayload): boolean {
  return !!(payload.type && payload.table && payload.record);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: DisparadorPayload = await req.json();
    
    // Criar cliente Supabase com service role (para acessar dados de todos)
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Variáveis de ambiente do Supabase não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ============= HANDLER PARA DATABASE WEBHOOKS =============
    if (isDbWebhook(payload)) {
      console.log(`📡 Recebido webhook de banco: ${payload.type} em ${payload.table}`);
      
      // Handler para atendimentos_pastorais
      if (payload.table === "atendimentos_pastorais" && payload.type === "INSERT") {
        const resultado = await handleAtendimentoPastoral(supabase, payload.record as unknown as AtendimentoPastoralRecord);
        
        return new Response(
          JSON.stringify(resultado),
          {
            status: resultado.sucesso ? 200 : 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      
      // Outros handlers de tabela podem ser adicionados aqui
      console.log(`   Tabela ${payload.table} não tem handler específico`);
      return new Response(
        JSON.stringify({ sucesso: true, mensagem: "Webhook recebido, sem handler" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ============= HANDLER PADRÃO (EVENTOS MANUAIS) =============
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
          let sucesso = false;
          if (dados?.igreja_id) {
            // Multi-tenant: resolve webhook correto via tabela webhooks
            sucesso = await dispararWhatsAppMultiTenant(
              supabase,
              dados.igreja_id,
              destinatario.telefone,
              mensagem,
              evento,
              templateMeta,
              dados.filial_id || null
            );
          } else {
            // Fallback legado (env var global)
            sucesso = await dispararWhatsApp(
              destinatario.telefone,
              mensagem,
              evento,
              providerWhats,
              templateMeta
            );
          }
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
