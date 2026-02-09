// Edge Function: buscar-pix-recebidos
// Polling: Busca PIX recebidos via GET /pix (para PIX espontâneos sem cobrança)
// Usa credenciais criptografadas do banco (integracoes_financeiras_secrets) + mTLS

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import forge from "npm:node-forge@1.3.1";

const SANTANDER_PIX_TOKEN_URL = "https://trust-pix.santander.com.br/oauth/token";
const SANTANDER_PIX_BASE_URL = "https://trust-pix.santander.com.br/api/v1";

interface BuscarPixRequest {
  integracao_id: string;
  igreja_id?: string;
  inicio?: string;
  fim?: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
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
  console.log("[buscar-pix] Requesting PIX OAuth2 token (mTLS)...");

  const basicAuth = btoa(`${creds.clientId}:${creds.clientSecret}`);
  const tokenBody = new URLSearchParams({
    client_id: creds.clientId,
    client_secret: creds.clientSecret,
    grant_type: "client_credentials",
    scope: "cob.read pix.read",
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
    console.warn("[buscar-pix] No mTLS client - request may fail!");
  }

  const response = await fetch(SANTANDER_PIX_TOKEN_URL, fetchOptions);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[buscar-pix] PIX Token failed:", response.status, errorText);
    return { error: `Falha na autenticação PIX: ${response.status} - ${errorText}` };
  }

  const data = await response.json();
  if (!data.access_token) return { error: "Token PIX não retornado pela API" };

  console.log("[buscar-pix] PIX Token obtained successfully");
  return { token: data.access_token };
}

// ==================== MAIN ====================

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
    const body: BuscarPixRequest = req.method === "POST" ? await req.json() : {};
    console.log("[buscar-pix] Request:", JSON.stringify(body));

    if (!body.integracao_id) {
      return jsonResponse({ error: "integracao_id é obrigatório" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const encryptionKey = Deno.env.get("WEBHOOK_ENCRYPTION_KEY");

    if (!encryptionKey) {
      return jsonResponse({ error: "WEBHOOK_ENCRYPTION_KEY não configurada" }, 500);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Buscar secrets criptografados
    const { data: secrets, error: secretsError } = await supabaseAdmin
      .from("integracoes_financeiras_secrets")
      .select("*")
      .eq("integracao_id", body.integracao_id)
      .single();

    if (secretsError || !secrets) {
      console.error("[buscar-pix] Secrets not found:", secretsError);
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
      console.error("[buscar-pix] Decryption failed:", error);
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
        console.log("[buscar-pix] mTLS HttpClient created");
      } catch (pfxError) {
        console.warn("[buscar-pix] PFX conversion failed, attempting without mTLS:", pfxError);
      }
    } else {
      console.warn("[buscar-pix] No PFX certificate found - will attempt standard TLS only");
    }

    // Obter token PIX (mTLS + Basic Auth)
    const tokenResult = await getSantanderPixToken({ clientId, clientSecret, httpClient });
    if ("error" in tokenResult) {
      return jsonResponse({ error: tokenResult.error }, 500);
    }

    // Definir período de busca
    const fim = body.fim || new Date().toISOString();
    const inicio = body.inicio || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    // Buscar PIX recebidos
    const pixUrl = `${SANTANDER_PIX_BASE_URL}/pix?inicio=${encodeURIComponent(inicio)}&fim=${encodeURIComponent(fim)}`;
    console.log(`[buscar-pix] GET ${pixUrl}`);

    const pixFetchOptions: RequestInit & { client?: Deno.HttpClient } = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${tokenResult.token}`,
        "Content-Type": "application/json",
      },
    };
    if (httpClient) pixFetchOptions.client = httpClient;

    const pixResponse = await fetch(pixUrl, pixFetchOptions);

    if (!pixResponse.ok) {
      const errorText = await pixResponse.text();
      console.error("[buscar-pix] Santander error:", pixResponse.status, errorText);
      return jsonResponse({ error: `Santander API error: ${pixResponse.status}`, detail: errorText }, 500);
    }

    const resposta = await pixResponse.json();
    console.log(`[buscar-pix] PIX encontrados: ${resposta.pix?.length || 0}`);

    if (!resposta.pix || resposta.pix.length === 0) {
      return jsonResponse({
        success: true,
        message: "Nenhum PIX encontrado no período",
        importados: 0,
        duplicados: 0,
      });
    }

    // Buscar igreja_id da integração (para vincular PIX)
    const { data: integracao } = await supabaseAdmin
      .from("integracoes_financeiras")
      .select("igreja_id")
      .eq("id", body.integracao_id)
      .single();

    const igrejaId = body.igreja_id || integracao?.igreja_id || null;

    let importados = 0;
    let duplicados = 0;
    const erros: Array<{ endToEndId: string; erro: string }> = [];

    for (const pixItem of resposta.pix) {
      try {
        const endToEndId = pixItem.endToEndId;
        const valor = parseFloat(pixItem.valor);

        // Deduplicação
        const { data: existente } = await supabaseAdmin
          .from("pix_webhook_temp")
          .select("id")
          .eq("pix_id", endToEndId)
          .maybeSingle();

        if (existente) {
          duplicados++;
          continue;
        }

        // Vincular cobrança se txid existir
        let cobPixId: string | null = null;
        if (pixItem.txid) {
          const { data: cobranca } = await supabaseAdmin
            .from("cob_pix")
            .select("id")
            .eq("txid", pixItem.txid)
            .maybeSingle();
          if (cobranca) cobPixId = cobranca.id;
        }

        const { error: insertError } = await supabaseAdmin
          .from("pix_webhook_temp")
          .insert({
            pix_id: endToEndId,
            txid: pixItem.txid || null,
            cob_pix_id: cobPixId,
            valor,
            data_pix: new Date(pixItem.horario).toISOString(),
            descricao: "PIX Recebido (polling)",
            banco_id: "90400888000142",
            igreja_id: igrejaId,
            webhook_payload: pixItem,
            status: "recebido",
          });

        if (insertError) {
          erros.push({ endToEndId, erro: insertError.message });
        } else {
          importados++;
          if (cobPixId) {
            await supabaseAdmin
              .from("cob_pix")
              .update({ status: "CONCLUIDA", data_conclusao: new Date(pixItem.horario).toISOString() })
              .eq("id", cobPixId);
          }
        }
      } catch (itemError) {
        erros.push({
          endToEndId: pixItem.endToEndId || "unknown",
          erro: itemError instanceof Error ? itemError.message : String(itemError),
        });
      }
    }

    return jsonResponse({
      success: true,
      message: `${importados} PIX importados, ${duplicados} já existiam`,
      importados,
      duplicados,
      erros: erros.length > 0 ? erros : undefined,
    });
  } catch (error) {
    console.error("[buscar-pix] Erro:", error);
    return jsonResponse({
      error: "Erro ao buscar PIX",
      detail: error instanceof Error ? error.message : String(error),
    }, 500);
  } finally {
    if (httpClient) {
      try { httpClient.close(); } catch { /* ignore */ }
    }
  }
});
