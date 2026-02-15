/**
 * Edge Function: Sincronizar Conciliações de Transferências Bancárias
 * 
 * Esta função sincroniza o status de conciliação entre transações de ENTRADA
 * e SAÍDA que fazem parte de uma transferência bancária.
 * 
 * Lógica:
 * 1. Quando uma ENTRADA de transferência é conciliada com extrato
 * 2. A SAÍDA correspondente recebe o mesmo status
 * 3. Se a saída estava pendente, é marcada como paga
 * 
 * Deploy:
 *   supabase functions deploy sync-transferencias-conciliacao --no-verify
 * 
 * Agendamento (pg_cron):
 *   SELECT cron.schedule(
 *     'sync-transferencias-conciliacao',
 *     '0 2 * * *',  -- 2 AM todos os dias
 *     'SELECT content.http_post(
 *       ''http://localhost:54321/functions/v1/sync-transferencias-conciliacao'',
 *       jsonb_build_object(''_key'', ''pk_test_...''),
 *       ''POST''
 *     )'
 *   );
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export default async (req: Request) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validar autenticação
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: "Autenticação obrigatória",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Criar cliente Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente não configuradas");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extrair token JWT para obter contexto de usuário
    const token = authHeader.replace("Bearer ", "");

    // Parse JWT manualmente para obter claims
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Token JWT inválido");
    }

    const decodedJWT = JSON.parse(
      new TextDecoder().decode(Deno.core.decode(parts[1]))
    );
    const igrejaId = decodedJWT.app_metadata?.igreja_id;
    const userId = decodedJWT.sub;

    if (!igrejaId) {
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: "Sem acesso à identificação da igreja",
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Chamar a função RPC de sincronização
    const { data: resultado, error: rpcError } = await supabase.rpc(
      "sincronizar_transferencias_reconciliacao",
      {
        p_limite: 500, // Processa até 500 transferências por execução
      }
    );

    if (rpcError) {
      console.error("Erro na RPC:", rpcError);
      throw rpcError;
    }

    // Log de sucesso
    console.log(`Sincronização concluída:`, resultado);

    return new Response(
      JSON.stringify({
        sucesso: true,
        resultado,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Erro na sincronização:", error);

    return new Response(
      JSON.stringify({
        sucesso: false,
        erro: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};
