// Edge Function: buscar-pix-recebidos
// Polling: Busca PIX recebidos via GET /pix (para PIX espontâneos sem cobrança)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const SANTANDER_PIX_BASE_URL = "https://trust-pix.santander.com.br";
const SANTANDER_OAUTH_URL = `${SANTANDER_PIX_BASE_URL}/oauth/token?grant_type=client_credentials`;

interface BuscarPixRequest {
  igreja_id?: string;
  inicio?: string;
  fim?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

async function obterTokenSantander(): Promise<string | null> {
  try {
    const clientId = Deno.env.get("SANTANDER_CLIENT_ID");
    const clientSecret = Deno.env.get("SANTANDER_CLIENT_SECRET");
    
    if (!clientId || !clientSecret) {
      throw new Error("Credenciais Santander não configuradas");
    }

    const response = await fetch(SANTANDER_OAUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[buscar-pix] Erro OAuth:", errorText);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("[buscar-pix] Exceção ao obter token:", error);
    return null;
  }
}

async function buscarIgrejaPorCnpj(cnpj: string): Promise<string | null> {
  const cnpjLimpo = cnpj.replace(/[^\d]/g, "");
  
  const { data, error } = await supabase
    .from("igrejas")
    .select("id")
    .eq("cnpj", cnpjLimpo)
    .maybeSingle();

  if (error || !data) {
    console.warn(`[buscar-pix] Igreja não encontrada para CNPJ: ${cnpj}`);
    return null;
  }

  return data.id;
}

async function buscarPixSantander(
  token: string,
  inicio: string,
  fim: string
): Promise<any> {
  const url = `${SANTANDER_PIX_BASE_URL}/api/v1/pix?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`;
  
  console.log(`[buscar-pix] URL: ${url}`);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[buscar-pix] Erro ao buscar PIX:", errorText);
    throw new Error(`Santander API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BuscarPixRequest = req.method === "POST" 
      ? await req.json() 
      : {};
    
    console.log("[buscar-pix] Request:", JSON.stringify(body));

    const fim = body.fim || new Date().toISOString();
    const inicio = body.inicio || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const token = await obterTokenSantander();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Falha ao autenticar com Santander" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resposta = await buscarPixSantander(token, inicio, fim);
    
    console.log(`[buscar-pix] PIX encontrados: ${resposta.pix?.length || 0}`);

    if (!resposta.pix || resposta.pix.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Nenhum PIX encontrado no período",
          importados: 0,
          duplicados: 0,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let importados = 0;
    let duplicados = 0;
    const erros: Array<{ endToEndId: string; erro: string }> = [];

    for (const pixItem of resposta.pix) {
      try {
        const endToEndId = pixItem.endToEndId;
        const valor = parseFloat(pixItem.valor);

        const { data: existente } = await supabase
          .from("pix_webhook_temp")
          .select("id")
          .eq("pix_id", endToEndId)
          .maybeSingle();

        if (existente) {
          console.log(`[buscar-pix] PIX ${endToEndId} já existe (duplicado)`);
          duplicados++;
          continue;
        }

        let cobPixId: string | null = null;
        if (pixItem.txid) {
          const { data: cobranca } = await supabase
            .from("cob_pix")
            .select("id")
            .eq("txid", pixItem.txid)
            .maybeSingle();

          if (cobranca) {
            cobPixId = cobranca.id;
            console.log(`[buscar-pix] PIX ${endToEndId} vinculado à cobrança ${pixItem.txid}`);
          }
        }

        const igrejaId = null;  // TODO: Melhorar vinculação

        const { error: insertError } = await supabase
          .from("pix_webhook_temp")
          .insert({
            pix_id: endToEndId,
            txid: pixItem.txid || null,
            cob_pix_id: cobPixId,
            valor: valor,
            data_pix: new Date(pixItem.horario).toISOString(),
            descricao: "PIX Recebido (polling)",
            banco_id: "90400888000142",
            igreja_id: igrejaId,
            webhook_payload: pixItem,
            status: "recebido",
          });

        if (insertError) {
          console.error(`[buscar-pix] Erro ao inserir ${endToEndId}:`, insertError);
          erros.push({ endToEndId, erro: insertError.message });
        } else {
          console.log(`[buscar-pix] PIX ${endToEndId} importado com sucesso`);
          importados++;

          if (cobPixId) {
            await supabase
              .from("cob_pix")
              .update({
                status: "CONCLUIDA",
                data_conclusao: new Date(pixItem.horario).toISOString(),
              })
              .eq("id", cobPixId);
          }
        }
      } catch (itemError) {
        console.error(`[buscar-pix] Erro ao processar item:`, itemError);
        erros.push({
          endToEndId: pixItem.endToEndId || "unknown",
          erro: itemError instanceof Error ? itemError.message : String(itemError),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `${importados} PIX importados, ${duplicados} já existiam`,
        importados,
        duplicados,
        erros: erros.length > 0 ? erros : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[buscar-pix] Erro:", error);
    return new Response(
      JSON.stringify({
        error: "Erro ao buscar PIX",
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
