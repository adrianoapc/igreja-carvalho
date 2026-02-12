import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { resolverWebhookComRemetente } from "../_shared/webhook-resolver.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function normalize(str: string | null | undefined): string {
  return str?.toLowerCase().replace(/[^a-z0-9]/g, "") || "";
}

function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const matrix: number[][] = [];
  for (let i = 0; i <= a.length; i++) matrix[i] = [i];
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return 1 - matrix[a.length][b.length] / Math.max(a.length, b.length);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ========== ETAPA 1: DETECÇÃO DE DUPLICATAS ==========
    console.log("[automacao-duplicatas] Iniciando detecção...");

    const { data: pessoas, error } = await supabase
      .from("profiles")
      .select("id, nome, data_nascimento, email, telefone, igreja_id, filial_id")
      .or("is_merged.is.null,is_merged.eq.false");

    if (error) {
      console.error("[automacao-duplicatas] Erro ao buscar profiles:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!pessoas || pessoas.length === 0) {
      return new Response(
        JSON.stringify({ message: "Nenhuma pessoa encontrada", relatorio: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[automacao-duplicatas] Analisando ${pessoas.length} pessoas...`);

    const suspeitas: Array<{
      pessoa_id_1: string;
      pessoa_id_2: string;
      score_similaridade: number;
      campos_conflitantes: Record<string, unknown>;
    }> = [];

    for (let i = 0; i < pessoas.length; i++) {
      for (let j = i + 1; j < pessoas.length; j++) {
        const p1 = pessoas[i];
        const p2 = pessoas[j];

        const scoreNome = levenshteinSimilarity(normalize(p1.nome), normalize(p2.nome));
        const scoreEmail = levenshteinSimilarity(normalize(p1.email), normalize(p2.email));
        const scoreTel = levenshteinSimilarity(normalize(p1.telefone), normalize(p2.telefone));
        const scoreNasc =
          p1.data_nascimento && p2.data_nascimento && p1.data_nascimento === p2.data_nascimento
            ? 1
            : 0;

        const score = scoreNome * 0.5 + scoreEmail * 0.2 + scoreTel * 0.2 + scoreNasc * 0.1;

        if (score > 0.85) {
          suspeitas.push({
            pessoa_id_1: p1.id,
            pessoa_id_2: p2.id,
            score_similaridade: parseFloat(score.toFixed(4)),
            campos_conflitantes: {
              nome: [p1.nome, p2.nome],
              email: [p1.email, p2.email],
              telefone: [p1.telefone, p2.telefone],
              data_nascimento: [p1.data_nascimento, p2.data_nascimento],
            },
          });
        }
      }
    }

    // Inserir suspeitas
    let inserted = 0;
    for (const s of suspeitas) {
      const { error: insertError } = await supabase
        .from("pessoas_duplicatas_suspeitas")
        .insert({ ...s, status: "pendente" });

      if (!insertError) inserted++;
      else console.warn("[automacao-duplicatas] Erro ao inserir:", insertError.message);
    }

    console.log(`[automacao-duplicatas] ${inserted}/${suspeitas.length} suspeitas inseridas.`);

    // ========== ETAPA 2: NOTIFICAÇÃO ==========

    // Buscar contagem de pendentes
    const { count: pendentesCount } = await supabase
      .from("pessoas_duplicatas_suspeitas")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente");

    const totalPendentes = pendentesCount || 0;

    if (totalPendentes > 0) {
      // 2a. Notificação in-app via notify_admins
      const { error: notifyError } = await supabase.rpc("notify_admins", {
        p_title: "Suspeitas de Duplicidade de Pessoas",
        p_message: `${totalPendentes} duplicata(s) suspeita(s) aguardando revisão.`,
        p_type: "duplicidade_pessoas",
      });

      if (notifyError) {
        console.warn("[automacao-duplicatas] Erro ao notificar admins in-app:", notifyError.message);
      } else {
        console.log("[automacao-duplicatas] ✅ Notificação in-app enviada.");
      }

      // 2b. Notificação WhatsApp para admins com telefone
      const { data: admins } = await supabase
        .from("user_app_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const adminUserIds = admins.map((a: { user_id: string }) => a.user_id);

        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("telefone, igreja_id, filial_id")
          .in("user_id", adminUserIds)
          .not("telefone", "is", null);

        if (adminProfiles && adminProfiles.length > 0) {
          const mensagemWhatsApp = `📋 *Alerta de Duplicidade*\n\n${totalPendentes} pessoa(s) com suspeita de cadastro duplicado aguardando revisão.\n\nAcesse o sistema para revisar e mesclar os registros.`;

          // Agrupar por igreja para usar o webhook correto
          const porIgreja = new Map<string, Array<{ telefone: string; filial_id: string | null }>>();
          for (const admin of adminProfiles) {
            if (!admin.igreja_id || !admin.telefone) continue;
            if (!porIgreja.has(admin.igreja_id)) {
              porIgreja.set(admin.igreja_id, []);
            }
            porIgreja.get(admin.igreja_id)!.push({
              telefone: admin.telefone,
              filial_id: admin.filial_id,
            });
          }

          for (const [igrejaId, adminsList] of porIgreja) {
            // Resolver webhook uma vez por igreja
            const resolucao = await resolverWebhookComRemetente(
              supabase,
              igrejaId,
              adminsList[0]?.filial_id || null,
              "whatsapp_make"
            );

            if (!resolucao?.webhookUrl) {
              console.warn(`[automacao-duplicatas] Sem webhook WhatsApp para igreja ${igrejaId}`);
              continue;
            }

            for (const admin of adminsList) {
              try {
                const payload = {
                  telefone: admin.telefone,
                  whatsapp_remetente: resolucao.whatsappRemetente,
                  whatsapp_sender_id: resolucao.whatsappSenderId,
                  mensagem: mensagemWhatsApp,
                  template: "duplicidade_pessoas",
                  webhook_nivel: resolucao.webhookNivel,
                  timestamp: new Date().toISOString(),
                };

                const response = await fetch(resolucao.webhookUrl, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                });

                if (response.ok) {
                  console.log(`[automacao-duplicatas] ✅ WhatsApp enviado para ${admin.telefone}`);
                } else {
                  console.warn(`[automacao-duplicatas] Falha WhatsApp ${admin.telefone}: ${response.statusText}`);
                }
              } catch (whatsappErr) {
                console.error(`[automacao-duplicatas] Erro WhatsApp ${admin.telefone}:`, whatsappErr);
              }
            }
          }
        }
      }
    } else {
      console.log("[automacao-duplicatas] Nenhuma pendente, notificação não enviada.");
    }

    // ========== ETAPA 3: RELATÓRIO ==========
    const { data: relatorio } = await supabase.rpc("relatorio_duplicidade_pessoas");

    console.log("[automacao-duplicatas] Relatório:", JSON.stringify(relatorio));

    return new Response(
      JSON.stringify({
        deteccao: {
          total_analisadas: pessoas.length,
          suspeitas_encontradas: suspeitas.length,
          inseridas: inserted,
        },
        notificacao: {
          pendentes_notificadas: totalPendentes,
        },
        relatorio,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[automacao-duplicatas] Erro inesperado:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
