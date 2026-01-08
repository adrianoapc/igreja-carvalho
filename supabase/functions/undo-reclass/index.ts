import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  // Suporte a CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { job_id } = await req.json();
    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id é obrigatório" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("reclass_jobs")
      .select("id, igreja_id, filial_id, user_id, status, created_at")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      return new Response(JSON.stringify({ error: "Job não encontrado" }), {
        status: 404,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (job.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    if (job.status !== "completed") {
      return new Response(JSON.stringify({ error: "Apenas jobs concluídos podem ser desfeitos" }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Janela de undo: opcional (24h). Não implementado check de tempo aqui.

    const { data: itens, error: itensError } = await supabase
      .from("reclass_job_items")
      .select("transacao_id, antes")
      .eq("job_id", job_id)
      .eq("status", "updated");

    if (itensError) throw itensError;
    if (!itens || !itens.length) {
      return new Response(JSON.stringify({ error: "Nenhum item para reverter" }), {
        status: 404,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    }

    // Reverte campos alterados
    const beforeUpdates = itens.map((it) => ({
      id: it.transacao_id,
      ...it.antes,
      updated_at: new Date().toISOString(),
    }));

    const { error: updateError } = await supabase
      .from("transacoes_financeiras")
      .upsert(beforeUpdates, { onConflict: "id" });

    if (updateError) throw updateError;

    await supabase.from("reclass_jobs").update({ status: "undone" }).eq("id", job_id);
    await supabase
      .from("reclass_job_items")
      .update({ status: "reverted" })
      .eq("job_id", job_id)
      .eq("status", "updated");

    return new Response(
      JSON.stringify({ success: true, reverted: beforeUpdates.length }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    console.error("Erro undo-reclass:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      {
        status: 500,
        headers: { 
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
