import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get auth user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify token
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id } = await req.json();

    if (!job_id) {
      return new Response(JSON.stringify({ error: "job_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the job - verify ownership and status
    const { data: job, error: jobError } = await supabase
      .from("import_jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", user.id)
      .single();

    if (jobError || !job) {
      return new Response(
        JSON.stringify({ error: "Job not found or unauthorized" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (job.status !== "completed") {
      return new Response(
        JSON.stringify({
          error: "Only completed jobs can be undone",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Get all imported transaction IDs from this job
    const { data: jobItems, error: itemsError } = await supabase
      .from("import_job_items")
      .select("transacao_id")
      .eq("job_id", job_id)
      .eq("status", "imported")
      .not("transacao_id", "is", null);

    if (itemsError) {
      throw itemsError;
    }

    const transacaoIds = jobItems?.map((item) => item.transacao_id) || [];

    // Delete transactions
    if (transacaoIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("transacoes_financeiras")
        .delete()
        .in("id", transacaoIds);

      if (deleteError) {
        throw deleteError;
      }
    }

    // Update job status to 'undone'
    const { error: updateError } = await supabase
      .from("import_jobs")
      .update({
        status: "undone",
        undone_at: new Date().toISOString(),
      })
      .eq("id", job_id);

    if (updateError) {
      throw updateError;
    }

    // Update all job items to 'deleted'
    const { error: updateItemsError } = await supabase
      .from("import_job_items")
      .update({ status: "deleted" })
      .eq("job_id", job_id)
      .eq("status", "imported");

    if (updateItemsError) {
      throw updateItemsError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Import undone. ${transacaoIds.length} transactions deleted.`,
        deleted_count: transacaoIds.length,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
