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
 * Chamada por um usuário autenticado (não service role): a RPC
 * `sincronizar_transferencias_reconciliacao` resolve o tenant via
 * get_jwt_igreja_id()/get_jwt_filial_id()/auth.uid() na sessão Postgres,
 * então o client precisa repassar o Authorization do chamador pro
 * PostgREST propagar esses claims — daí o anon key + header, não
 * service role key.
 *
 * Deploy:
 *   supabase functions deploy sync-transferencias-conciliacao --no-verify
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Payload de um JWT já verificado pela Edge Runtime (verify_jwt=true,
// default deste projeto) — decodifica só pra ler claims, sem reverificar
// assinatura. `Deno.core` (versão anterior) não existe no runtime público.
function decodeJwtPayload(token: string): { sub?: string; app_metadata?: { igreja_id?: string } } {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Token JWT inválido");
  }
  const normalized = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

Deno.serve(async (req) => {
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Variáveis de ambiente não configuradas");
    }

    // Repassa o JWT do chamador — PostgREST propaga esses claims pra
    // sessão Postgres, de onde a RPC lê o tenant.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    let igrejaId: string | undefined;
    try {
      igrejaId = decodeJwtPayload(token).app_metadata?.igreja_id;
    } catch (decodeError) {
      console.error("Erro ao decodificar JWT:", decodeError);
      return new Response(
        JSON.stringify({
          sucesso: false,
          erro: "Token inválido",
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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
});
