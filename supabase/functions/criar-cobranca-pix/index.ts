// Edge Function: criar-cobranca-pix
// Cria cobrança PIX via API Santander e retorna QR code

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
);

const SANTANDER_PIX_BASE_URL = "https://trust-pix.santander.com.br";
const SANTANDER_OAUTH_URL = `${SANTANDER_PIX_BASE_URL}/oauth/token?grant_type=client_credentials`;

interface CriarCobrancaRequest {
  igreja_id: string;
  filial_id?: string;
  sessao_item_id?: string;
  conta_id?: string;
  valor: number;              // Valor em reais (ex: 150.00)
  descricao?: string;
  expiracao?: number;         // Segundos (default: 3600 = 1h)
  info_adicionais?: Array<{ nome: string; valor: string }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Gera txid único (35 caracteres alfanuméricos - padrão Santander)
function gerarTxid(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let txid = "";
  for (let i = 0; i < 35; i++) {
    txid += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return txid;
}

// Busca chave PIX (CNPJ) da igreja
async function buscarChavePixIgreja(igrejaId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("igrejas")
    .select("cnpj")
    .eq("id", igrejaId)
    .single();

  if (error || !data?.cnpj) {
    console.error("[criar-cobranca-pix] Erro ao buscar CNPJ:", error);
    return null;
  }

  // Remover formatação do CNPJ
  return data.cnpj.replace(/[^\d]/g, "");
}

// Obter token OAuth2 do Santander
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
      console.error("[criar-cobranca-pix] Erro OAuth:", errorText);
      return null;
    }

    const data = await response.json();
    return data.access_token;
  } catch (error) {
    console.error("[criar-cobranca-pix] Exceção ao obter token:", error);
    return null;
  }
}

// Criar cobrança via API Santander
async function criarCobrancaSantander(
  token: string,
  txid: string,
  chavePix: string,
  valor: number,
  descricao: string,
  expiracao: number,
  infoAdicionais: Array<{ nome: string; valor: string }>
) {
  const url = `${SANTANDER_PIX_BASE_URL}/api/v1/cob/${txid}`;
  
  const payload = {
    calendario: {
      expiracao: expiracao.toString(),
    },
    valor: {
      original: valor.toFixed(2),
    },
    chave: chavePix,
    solicitacaoPagador: descricao || "Pagamento via PIX",
    infoAdicionais: infoAdicionais,
  };

  console.log("[criar-cobranca-pix] Payload:", JSON.stringify(payload));

  const response = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[criar-cobranca-pix] Erro ao criar cobrança:", errorText);
    throw new Error(`Santander API error: ${response.status} - ${errorText}`);
  }

  return await response.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ error: "Método não permitido" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CriarCobrancaRequest = await req.json();
    console.log("[criar-cobranca-pix] Request:", JSON.stringify(body));

    // Validações
    if (!body.igreja_id || !body.valor || body.valor <= 0) {
      return new Response(
        JSON.stringify({ error: "igreja_id e valor são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar chave PIX (CNPJ) da igreja
    const chavePix = await buscarChavePixIgreja(body.igreja_id);
    if (!chavePix) {
      return new Response(
        JSON.stringify({ error: "CNPJ da igreja não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Obter token Santander
    const token = await obterTokenSantander();
    if (!token) {
      return new Response(
        JSON.stringify({ error: "Falha ao autenticar com Santander" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Gerar txid único
    const txid = gerarTxid();
    
    // Preparar infoAdicionais
    const infoAdicionais = body.info_adicionais || [];
    if (body.sessao_item_id) {
      infoAdicionais.push({
        nome: "sessao_item_id",
        valor: body.sessao_item_id,
      });
    }

    // Criar cobrança no Santander
    const expiracao = body.expiracao || 3600;
    const resposta = await criarCobrancaSantander(
      token,
      txid,
      chavePix,
      body.valor,
      body.descricao || "Pagamento via PIX",
      expiracao,
      infoAdicionais
    );

    console.log("[criar-cobranca-pix] Resposta Santander:", JSON.stringify(resposta));

    // Calcular data de expiração
    const dataExpiracao = new Date();
    dataExpiracao.setSeconds(dataExpiracao.getSeconds() + expiracao);

    // Salvar cobrança no banco
    const { data: cobPix, error: dbError } = await supabase
      .from("cob_pix")
      .insert({
        txid: txid,
        igreja_id: body.igreja_id,
        filial_id: body.filial_id || null,
        sessao_item_id: body.sessao_item_id || null,
        conta_id: body.conta_id || null,
        valor_original: body.valor,
        chave_pix: chavePix,
        descricao: body.descricao,
        qr_location: resposta.location,
        status: resposta.status || "ATIVA",
        expiracao: expiracao,
        info_adicionais: infoAdicionais,
        payload_resposta: resposta,
        data_criacao: new Date(resposta.calendario?.criacao || Date.now()).toISOString(),
        data_expiracao: dataExpiracao.toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("[criar-cobranca-pix] Erro ao salvar no DB:", dbError);
      throw dbError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        cobranca: {
          id: cobPix.id,
          txid: cobPix.txid,
          qr_location: cobPix.qr_location,
          valor: cobPix.valor_original,
          status: cobPix.status,
          expira_em: cobPix.data_expiracao,
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[criar-cobranca-pix] Erro:", error);
    return new Response(
      JSON.stringify({
        error: "Erro ao criar cobrança",
        detail: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
