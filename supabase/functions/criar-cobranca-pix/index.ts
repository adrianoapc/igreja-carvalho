// Edge Function: criar-cobranca-pix
// Cria cobrança PIX via API Santander e retorna QR code
// Usa credenciais criptografadas do banco (integracoes_financeiras_secrets) + mTLS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import forge from "npm:node-forge@1.3.1";

const SANTANDER_PIX_TOKEN_URL = "https://trust-pix.santander.com.br/oauth/token";
const SANTANDER_PIX_BASE_URL = "https://trust-pix.santander.com.br/api/v1";

interface CriarCobrancaRequest {
  integracao_id: string;
  igreja_id: string;
  filial_id?: string;
  sessao_item_id?: string;
  conta_id?: string;
  valor: number;
  descricao?: string;
  expiracao?: number;
  info_adicionais?: Array<{ nome: string; valor: string }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ==================== ENCRYPTION UTILITIES ====================

function base64ToUint8Array(base64: string): Uint8Array {
  let normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4) normalized += "=";
  const binaryString = atob(normalized);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function deriveKey(masterKey: string): Uint8Array {
  const trimmed = masterKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) bytes[i] = parseInt(trimmed.substring(i * 2, i * 2 + 2), 16);
    return bytes;
  }
  if (/^[A-Za-z0-9+/]{43}=?$/.test(trimmed) || /^[A-Za-z0-9+/]{44}$/.test(trimmed)) {
    const decoded = base64ToUint8Array(trimmed);
    if (decoded.length === 32) return decoded;
    const key = new Uint8Array(32);
    key.set(decoded.slice(0, 32));
    return key;
  }
  const encoded = new TextEncoder().encode(trimmed);
  const key = new Uint8Array(32);
  key.set(encoded.slice(0, 32));
  return key;
}

function byteaToString(value: unknown): string {
  if (typeof value === "string") {
    if (value.startsWith("\\x")) {
      const hexStr = value.slice(2);
      const bytes = new Uint8Array(hexStr.length / 2);
      for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hexStr.substring(i * 2, i * 2 + 2), 16);
      return new TextDecoder().decode(bytes);
    }
    return value;
  }
  if (value instanceof Uint8Array) return new TextDecoder().decode(value);
  if (value instanceof ArrayBuffer) return new TextDecoder().decode(new Uint8Array(value));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (Array.isArray(obj.data)) return new TextDecoder().decode(new Uint8Array(obj.data as number[]));
  }
  return String(value);
}

function decryptData(encrypted: unknown, key: Uint8Array): string {
  const encryptedStr = byteaToString(encrypted);
  try {
    if (encryptedStr.startsWith("{") && encryptedStr.includes('"data":[')) {
      try {
        const parsed = JSON.parse(encryptedStr);
        if (Array.isArray(parsed.data)) return new TextDecoder().decode(new Uint8Array(parsed.data));
      } catch { /* continue */ }
    }
    const combined = base64ToUint8Array(encryptedStr);
    if (combined.length < 25) return encryptedStr;
    const nonce = combined.slice(0, 24);
    const ciphertext = combined.slice(24);
    const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
    if (!decrypted) return encryptedStr;
    return new TextDecoder().decode(decrypted);
  } catch {
    return encryptedStr;
  }
}

function pfxToPem(pfxData: string, password?: string): { cert: string; key: string } {
  try {
  let pfxDer: string;
  // Limpar whitespace/newlines antes de processar
  const cleanPfx = pfxData.replace(/[\s\n\r]/g, "");
  
  if (cleanPfx.startsWith("{")) {
    try {
      const parsed = JSON.parse(pfxData); // usar original para JSON
      if (Array.isArray(parsed.data)) {
        const uint8 = new Uint8Array(parsed.data);
        let binary = "";
        for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i]);
        pfxDer = binary;
      } else throw new Error("JSON does not contain data array");
    } catch (err) {
      throw new Error(`Invalid JSON PFX: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else if (/^[A-Za-z0-9+/]*={0,2}$/.test(cleanPfx)) {
    pfxDer = forge.util.decode64(cleanPfx);
  } else {
    try {
      pfxDer = forge.util.decode64(btoa(unescape(encodeURIComponent(cleanPfx))));
    } catch {
      pfxDer = cleanPfx;
    }
  }
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const p12 = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password || "");
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const certBag = certBags[forge.pki.oids.certBag]?.[0];
  if (!certBag?.cert) throw new Error("Certificate not found in PFX");
  const cert = forge.pki.certificateToPem(certBag.cert);
  const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
  const keyBag = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag]?.[0];
  if (!keyBag?.key) throw new Error("Private key not found in PFX");
  const key = forge.pki.privateKeyToPem(keyBag.key);
  return { cert, key };
  } catch (error) {
    throw new Error(`PFX conversion failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// ==================== PIX TOKEN (mTLS + Basic Auth) ====================

interface SantanderPixCredentials {
  clientId: string;
  clientSecret: string;
  httpClient: Deno.HttpClient | null;
}

async function getSantanderPixToken(
  creds: SantanderPixCredentials
): Promise<{ token: string } | { error: string }> {
  console.log("[criar-cobranca-pix] Requesting PIX OAuth2 token (mTLS)...");

  const basicAuth = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const tokenBody = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "client_credentials",
    scope: "cob.write cob.read pix.write pix.read",
  }).toString();

  const fetchOptions: RequestInit & { client?: Deno.HttpClient } = {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: tokenBody,
  };

  if (creds.httpClient) {
    fetchOptions.client = creds.httpClient;
  } else {
    console.warn("[criar-cobranca-pix] No mTLS client - request may fail!");
  }

  const response = await fetch(SANTANDER_PIX_TOKEN_URL, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[criar-cobranca-pix] PIX Token failed:", response.status, errorText);
    return { error: `Falha na autenticação PIX: ${response.status} - ${errorText}` };
  }

  const data = await response.json();
  if (!data.access_token) return { error: "Token PIX não retornado pela API" };

  console.log("[criar-cobranca-pix] PIX Token obtained successfully");
  return { token: data.access_token };
}

// ==================== MAIN ====================

function gerarTxid(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let txid = "";
  for (let i = 0; i < 35; i++) txid += chars.charAt(Math.floor(Math.random() * chars.length));
  return txid;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let httpClient: Deno.HttpClient | null = null;

  try {
    if (req.method !== "POST") {
      return jsonResponse({ error: "Método não permitido" }, 405);
    }

    const body: CriarCobrancaRequest = await req.json();
    console.log("[criar-cobranca-pix] Request:", JSON.stringify(body));

    if (!body.integracao_id || !body.igreja_id || !body.valor || body.valor <= 0) {
      return jsonResponse({ error: "integracao_id, igreja_id e valor são obrigatórios" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const encryptionKey = Deno.env.get("WEBHOOK_ENCRYPTION_KEY");

    if (!encryptionKey) {
      return jsonResponse({ error: "WEBHOOK_ENCRYPTION_KEY não configurada" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Buscar chave PIX (CNPJ) da igreja
    const { data: igrejaData, error: igrejaError } = await supabaseAdmin
      .from("igrejas")
      .select("cnpj")
      .eq("id", body.igreja_id)
      .single();

    if (igrejaError || !igrejaData?.cnpj) {
      return jsonResponse({ error: "CNPJ da igreja não encontrado" }, 404);
    }

    const chavePix = igrejaData.cnpj.replace(/[^\d]/g, "");

    // Buscar secrets criptografados
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from("integracoes_financeiras_secrets")
      .select("*")
      .eq("integracao_id", body.integracao_id)
      .single();

    if (secretsError || !secrets) {
      console.error("[criar-cobranca-pix] Secrets not found:", secretsError);
      return jsonResponse({ error: "Credenciais não encontradas" }, 404);
    }

    // Descriptografar
    const derivedKey = deriveKey(encryptionKey);
    let clientId: string | null = null;
    let clientSecret: string | null = null;
    let pfxBlob: string | null = null;
    let pfxPassword: string | null = null;

    try {
      if (secrets.client_id) clientId = decryptData(secrets.client_id, derivedKey);
      if (secrets.client_secret) clientSecret = decryptData(secrets.client_secret, derivedKey);
      if (secrets.pfx_blob) pfxBlob = decryptData(secrets.pfx_blob, derivedKey);
      if (secrets.pfx_password) pfxPassword = decryptData(secrets.pfx_password, derivedKey);
    } catch (error) {
      console.error("[criar-cobranca-pix] Decryption failed:", error);
      return jsonResponse({ error: "Falha na descriptografia das credenciais" }, 500);
    }

    if (!clientId || !clientSecret) {
      return jsonResponse({ error: "Client ID ou Secret não encontrado" }, 400);
    }

    // Criar mTLS HttpClient
    if (pfxBlob && pfxPassword) {
      try {
        const { cert, key } = pfxToPem(pfxBlob, pfxPassword);
        httpClient = Deno.createHttpClient({ cert, key });
        console.log("[criar-cobranca-pix] mTLS HttpClient created");
      } catch (pfxError) {
        console.warn("[criar-cobranca-pix] PFX conversion failed, attempting without mTLS:", pfxError);
      }
    } else {
      console.warn("[criar-cobranca-pix] No PFX certificate found - will attempt standard TLS only");
    }

    // Obter token PIX (mTLS + Basic Auth)
    const tokenResult = await getSantanderPixToken({ clientId, clientSecret, httpClient });
    if ("error" in tokenResult) {
      return jsonResponse({ error: tokenResult.error }, 500);
    }

    // Gerar txid e criar cobrança
    const txid = gerarTxid();
    const expiracao = body.expiracao || 3600;
    const infoAdicionais = body.info_adicionais || [];
    if (body.sessao_item_id) {
      infoAdicionais.push({ nome: "sessao_item_id", valor: body.sessao_item_id });
    }

    const cobPayload = {
      calendario: { expiracao: expiracao.toString() },
      valor: { original: body.valor.toFixed(2) },
      chave: chavePix,
      solicitacaoPagador: body.descricao || "Pagamento via PIX",
      infoAdicionais,
    };

    console.log("[criar-cobranca-pix] PUT cob payload:", JSON.stringify(cobPayload));

    const cobUrl = `${SANTANDER_PIX_BASE_URL}/cob/${txid}`;
    const cobFetchOptions: RequestInit & { client?: Deno.HttpClient } = {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cobPayload),
    };
    if (httpClient) cobFetchOptions.client = httpClient;

    const cobResponse = await fetch(cobUrl, cobFetchOptions);

    if (!cobResponse.ok) {
      const errorText = await cobResponse.text();
      console.error("[criar-cobranca-pix] Santander error:", cobResponse.status, errorText);
      return jsonResponse({ error: `Santander API error: ${cobResponse.status}`, detail: errorText }, 500);
    }

    const resposta = await cobResponse.json();
    console.log("[criar-cobranca-pix] Resposta Santander:", JSON.stringify(resposta));

    // Calcular data de expiração
    const dataExpiracao = new Date();
    dataExpiracao.setSeconds(dataExpiracao.getSeconds() + expiracao);

    // Salvar cobrança no banco
    const { data: cobPix, error: dbError } = await supabaseAdmin
      .from("cob_pix")
      .insert({
        txid,
        igreja_id: body.igreja_id,
        filial_id: body.filial_id || null,
        sessao_item_id: body.sessao_item_id || null,
        conta_id: body.conta_id || null,
        valor_original: body.valor,
        chave_pix: chavePix,
        descricao: body.descricao,
        qr_location: resposta.location,
        status: resposta.status || "ATIVA",
        expiracao,
        info_adicionais: infoAdicionais,
        payload_resposta: resposta,
        data_criacao: new Date(resposta.calendario?.criacao || Date.now()).toISOString(),
        data_expiracao: dataExpiracao.toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("[criar-cobranca-pix] DB error:", dbError);
      return jsonResponse({ error: "Erro ao salvar cobrança", detail: dbError.message }, 500);
    }

    return jsonResponse({
      success: true,
      cobranca: {
        id: cobPix.id,
        txid: cobPix.txid,
        qr_location: cobPix.qr_location,
        valor: cobPix.valor_original,
        status: cobPix.status,
        expira_em: cobPix.data_expiracao,
      },
    });
  } catch (error) {
    console.error("[criar-cobranca-pix] Erro:", error);
    return jsonResponse({
      error: "Erro ao criar cobrança",
      detail: error instanceof Error ? error.message : String(error),
    }, 500);
  } finally {
    if (httpClient) {
      try { httpClient.close(); } catch { /* ignore */ }
    }
  }
});
