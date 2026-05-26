import { createClient } from "https://esm.sh/@supabase/supabase-js@2.86.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNCTION_NAME = "buscar-pix-cron";
const DEFAULT_LOOKBACK_DAYS = 7;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  if (!supabaseUrl || !serviceKey) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const { data: config } = await supabase
      .from("edge_function_config")
      .select("enabled")
      .eq("function_name", FUNCTION_NAME)
      .maybeSingle();

    if (config && config.enabled === false) {
      await supabase.rpc("log_edge_function_execution", {
        p_function_name: FUNCTION_NAME,
        p_status: "skipped",
        p_details: "Função desativada",
      });

      return new Response(
        JSON.stringify({ success: true, message: "Função desativada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: integracoes, error: integracaoError } = await supabase
      .from("integracoes_financeiras")
      .select("id, igreja_id")
      .eq("provedor", "santander");

    if (integracaoError) throw integracaoError;

    if (!integracoes || integracoes.length === 0) {
      await supabase.rpc("log_edge_function_execution", {
        p_function_name: FUNCTION_NAME,
        p_status: "success",
        p_details: "Nenhuma integração Santander encontrada",
      });

      return new Response(
        JSON.stringify({ success: true, message: "Nenhuma integração encontrada" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalImportados = 0;
    let totalDuplicados = 0;
    const erros: Array<{ integracao_id: string; erro: string }> = [];

    for (const integracao of integracoes) {
      try {
        // Buscar última sessão finalizada para calcular janela de sincronização
        // Usa a mesma lógica de RelatorioOferta.tsx e useFinanceiroSessao.ts
        const { data: ultimaSessao } = await supabase
          .from("sessoes_contagem")
          .select("data_fechamento")
          .eq("igreja_id", integracao.igreja_id)
          .eq("status", "finalizado")
          .order("data_fechamento", { ascending: false })
          .limit(1)
          .maybeSingle();

        const fim = new Date();
        let inicio: Date;

        if (ultimaSessao?.data_fechamento) {
          // Usar 1 segundo após o fechamento da última sessão
          inicio = new Date(ultimaSessao.data_fechamento);
          inicio.setSeconds(inicio.getSeconds() + 1);
        } else {
          // Fallback: últimos 7 dias
          inicio = new Date(Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/santander-api`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "buscar_pix",
            integracao_id: integracao.id,
            igreja_id: integracao.igreja_id,
            data_inicio: inicio.toISOString(),
            data_fim: fim.toISOString(),
          }),
        });

        const data = await response.json();

        if (!response.ok || !data?.success) {
          throw new Error(data?.error || `Erro ao buscar PIX (${response.status})`);
        }

        totalImportados += Number(data.importados || 0);
        totalDuplicados += Number(data.duplicados || 0);
      } catch (err) {
        erros.push({
          integracao_id: integracao.id,
          erro: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const status = erros.length > 0 && totalImportados === 0 ? "error" : erros.length > 0 ? "partial" : "success";

    await supabase.rpc("log_edge_function_execution", {
      p_function_name: FUNCTION_NAME,
      p_status: status,
      p_details: `importados=${totalImportados}; duplicados=${totalDuplicados}; erros=${erros.length}`,
    });

    // Notificar admins em caso de erro total
    if (status === "error" && erros.length > 0) {
      const mensagemErro = erros.map((e) => `Integração ${e.integracao_id}: ${e.erro}`).join("; ");
      
      await supabase.rpc("notify_admins", {
        p_titulo: "Erro ao buscar PIX automaticamente",
        p_mensagem: `Falha ao sincronizar PIX via cron. Erros: ${mensagemErro}`,
        p_tipo: "error",
        p_igreja_id: erros[0]?.integracao_id ? 
          (integracoes.find(i => i.id === erros[0].integracao_id)?.igreja_id || null) : 
          null,
      });
    }

    return new Response(
      JSON.stringify({
        success: status !== "error",
        importados: totalImportados,
        duplicados: totalDuplicados,
        erros: erros.length > 0 ? erros : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    await supabase.rpc("log_edge_function_execution", {
      p_function_name: FUNCTION_NAME,
      p_status: "error",
      p_details: errorMessage,
    });

    // Notificar admins sobre erro crítico
    await supabase.rpc("notify_admins", {
      p_titulo: "Erro crítico no cron de PIX",
      p_mensagem: `Falha geral ao executar buscar-pix-cron: ${errorMessage}`,
      p_tipo: "error",
      p_igreja_id: null, // erro geral, não específico de uma igreja
    });

    return new Response(
      JSON.stringify({
        success: false,
        error: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
