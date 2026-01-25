// supabase/functions/integracoes-config/index.ts
// Edge Function para criar/atualizar integrações financeiras + secrets com criptografia XSalsa20-Poly1305

import { createClient } from "npm:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CreateIntegracaoPayload = {
  action: "create_integracao";
  igreja_id: string;
  filial_id?: string | null;
  provedor: string;
  cnpj: string;
  ativo?: boolean;

  // credenciais (opcionais, dependendo do provedor)
  client_id?: string | null;
  client_secret?: string | null;
  application_key?: string | null;

  // PFX (base64)
  pfx_blob?: string | null;
  pfx_password?: string | null;
};

type UpdateIntegracaoPayload = {
  action: "update_integracao";
  id: string;
  igreja_id: string;
  cnpj: string;
  ativo?: boolean;

  // credenciais (opcionais - se fornecido um, todos os outros devem ser fornecidos)
  client_id?: string | null;
  client_secret?: string | null;
  application_key?: string | null;

  // PFX (base64)
  pfx_blob?: string | null;
  pfx_password?: string | null;
};

type IntegracaoPayload = CreateIntegracaoPayload | UpdateIntegracaoPayload;

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ==================== ENCRYPTION UTILITIES ====================

/**
 * Deriva uma chave de 32 bytes a partir da ENCRYPTION_KEY.
 * Suporta hex (64 chars) ou base64 (44 chars).
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++)
    bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  // btoa aceita string binária; usamos chunking para evitar "Maximum call stack size" em arrays grandes
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function deriveKey(masterKey: string): Uint8Array {
  const trimmed = masterKey.trim();

  // Se for hex (64 caracteres = 32 bytes em hex)
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }

  // Se for base64 (idealmente 32 bytes)
  if (
    /^[A-Za-z0-9+/]{43}=?$/.test(trimmed) ||
    /^[A-Za-z0-9+/]{44}$/.test(trimmed)
  ) {
    const decoded = base64ToUint8Array(trimmed);
    if (decoded.length === 32) return decoded;
    const key = new Uint8Array(32);
    key.set(decoded.slice(0, 32));
    return key;
  }

  // Fallback: usar os primeiros 32 bytes do UTF-8 (padded com zeros)
  const encoded = new TextEncoder().encode(trimmed);
  const key = new Uint8Array(32);
  key.set(encoded.slice(0, 32));
  return key;
}

/**
 * Criptografa dados usando XSalsa20-Poly1305 (secretbox).
 * Retorna base64(nonce || ciphertext).
 */
function encryptData(plaintext: string, key: Uint8Array): string {
  const nonce = nacl.randomBytes(nacl.secretbox.nonceLength); // 24 bytes
  const messageBytes = new TextEncoder().encode(plaintext);
  const ciphertext = nacl.secretbox(messageBytes, nonce, key);

  // Concatena nonce + ciphertext
  const combined = new Uint8Array(nonce.length + ciphertext.length);
  combined.set(nonce, 0);
  combined.set(ciphertext, nonce.length);

  return uint8ArrayToBase64(combined);
}

// ==================== PERMISSION VALIDATION ====================

async function validatePermissions(
  supabaseAdmin: any,
  userId: string,
  igrejaId: string
) {
  // Verificar roles: admin, admin_igreja, tesoureiro ou super_admin (global)
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, igreja_id")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin", "admin_igreja", "tesoureiro"]);

  if (error) {
    console.error("[integracoes-config] Error checking permissions", error);
    return false;
  }

  if (!data || data.length === 0) return false;

  // super_admin tem acesso global
  if (data.some((r: any) => r.role === "super_admin")) return true;

  // admin/admin_igreja/tesoureiro precisam estar vinculados à igreja específica
  return data.some(
    (r: any) =>
      r.igreja_id === igrejaId &&
      ["admin", "admin_igreja", "tesoureiro"].includes(r.role)
  );
}

// ==================== HANDLERS ====================

async function handleCreateIntegracao(
  payload: CreateIntegracaoPayload,
  userId: string,
  derivedKey: Uint8Array,
  supabaseAdmin: any
) {
  const igreja_id = payload.igreja_id;
  const filial_id = payload.filial_id ?? null;
  const provedor = (payload.provedor ?? "").trim();
  const cnpj = (payload.cnpj ?? "").trim();

  if (!igreja_id || !provedor || !cnpj) {
    return json(400, {
      error: "Missing required fields: igreja_id, provedor, cnpj",
    });
  }

  // Validação básica CNPJ (com ou sem máscara)
  if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/.test(cnpj)) {
    return json(400, { error: "Invalid CNPJ format" });
  }

  // Autorização (admin/tesoureiro)
  const hasPermission = await validatePermissions(
    supabaseAdmin,
    userId,
    igreja_id
  );
  if (!hasPermission) return json(403, { error: "Insufficient permissions" });

  // Criar integração (service role)
  const status = payload.ativo === false ? "inativo" : "ativo";

  const { data: integracao, error: integracaoError } = await supabaseAdmin
    .from("integracoes_financeiras")
    .insert({
      igreja_id,
      filial_id,
      cnpj: cnpj.replace(/\D/g, ""),
      provedor,
      status,
      config: {
        created_by: userId,
      },
    })
    .select(
      "id, igreja_id, filial_id, cnpj, provedor, status, config, created_at, updated_at"
    )
    .single();

  if (integracaoError || !integracao) {
    console.error(
      "[integracoes-config] Error creating integration",
      integracaoError
    );
    return json(500, { error: "Failed to create integration" });
  }

  // Persistir secrets CRIPTOGRAFADOS (service role)
  const hasSecrets =
    payload.client_id ||
    payload.client_secret ||
    payload.application_key ||
    payload.pfx_blob ||
    payload.pfx_password;

  if (hasSecrets) {
    console.log("[integracoes-config] Encrypting sensitive credentials...");

    const encryptedClientId = payload.client_id
      ? encryptData(payload.client_id, derivedKey)
      : null;

    const encryptedClientSecret = payload.client_secret
      ? encryptData(payload.client_secret, derivedKey)
      : null;

    const encryptedApplicationKey = payload.application_key
      ? encryptData(payload.application_key, derivedKey)
      : null;

    const encryptedPfxPassword = payload.pfx_password
      ? encryptData(payload.pfx_password, derivedKey)
      : null;

    const encryptedPfxBlob = payload.pfx_blob
      ? encryptData(payload.pfx_blob, derivedKey)
      : null;

    const { error: secretsError } = await supabaseAdmin
      .from("integracoes_financeiras_secrets")
      .insert({
        integracao_id: integracao.id,
        pfx_blob: encryptedPfxBlob,
        pfx_password: encryptedPfxPassword,
        client_id: encryptedClientId,
        client_secret: encryptedClientSecret,
        application_key: encryptedApplicationKey,
      });

    if (secretsError) {
      console.error(
        "[integracoes-config] Error storing encrypted secrets",
        secretsError
      );
      // rollback best-effort
      await supabaseAdmin
        .from("integracoes_financeiras")
        .delete()
        .eq("id", integracao.id);
      return json(500, { error: "Failed to store credentials securely" });
    }

    console.log(
      "[integracoes-config] Secrets encrypted and stored successfully"
    );
  }

  return json(201, { success: true, integracao });
}

async function handleUpdateIntegracao(
  payload: UpdateIntegracaoPayload,
  userId: string,
  derivedKey: Uint8Array,
  supabaseAdmin: any
) {
  const { id, igreja_id, cnpj, ativo } = payload;

  if (!id || !igreja_id || !cnpj) {
    return json(400, { error: "Missing required fields: id, igreja_id, cnpj" });
  }

  // Validação básica CNPJ
  if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/.test(cnpj)) {
    return json(400, { error: "Invalid CNPJ format" });
  }

  // Autorização
  const hasPermission = await validatePermissions(
    supabaseAdmin,
    userId,
    igreja_id
  );
  if (!hasPermission) return json(403, { error: "Insufficient permissions" });

  // Atualizar metadados (cnpj, status)
  const status = ativo === false ? "inativo" : "ativo";

  const { error: updateError } = await supabaseAdmin
    .from("integracoes_financeiras")
    .update({
      cnpj: cnpj.replace(/\D/g, ""),
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("igreja_id", igreja_id);

  if (updateError) {
    console.error(
      "[integracoes-config] Error updating integration",
      updateError
    );
    return json(500, { error: "Failed to update integration" });
  }

  // Se fornecidas novas credenciais, atualizar secrets
  const hasSecrets =
    payload.client_id ||
    payload.client_secret ||
    payload.application_key ||
    payload.pfx_blob ||
    payload.pfx_password;

  if (hasSecrets) {
    console.log("[integracoes-config] Encrypting updated credentials...");

    const encryptedClientId = payload.client_id
      ? encryptData(payload.client_id, derivedKey)
      : null;

    const encryptedClientSecret = payload.client_secret
      ? encryptData(payload.client_secret, derivedKey)
      : null;

    const encryptedApplicationKey = payload.application_key
      ? encryptData(payload.application_key, derivedKey)
      : null;

    const encryptedPfxPassword = payload.pfx_password
      ? encryptData(payload.pfx_password, derivedKey)
      : null;

    const encryptedPfxBlob = payload.pfx_blob
      ? encryptData(payload.pfx_blob, derivedKey)
      : null;

    // Deletar secrets antigos e inserir novos
    await supabaseAdmin
      .from("integracoes_financeiras_secrets")
      .delete()
      .eq("integracao_id", id);

    const { error: secretsError } = await supabaseAdmin
      .from("integracoes_financeiras_secrets")
      .insert({
        integracao_id: id,
        pfx_blob: encryptedPfxBlob,
        pfx_password: encryptedPfxPassword,
        client_id: encryptedClientId,
        client_secret: encryptedClientSecret,
        application_key: encryptedApplicationKey,
      });

    if (secretsError) {
      console.error(
        "[integracoes-config] Error storing updated secrets",
        secretsError
      );
      return json(500, { error: "Failed to store credentials securely" });
    }

    console.log(
      "[integracoes-config] Secrets updated and encrypted successfully"
    );
  }

  return json(200, { success: true });
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    const authHeader =
      req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer "))
      return json(401, { error: "Unauthorized" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey) {
      console.error("[integracoes-config] Missing Supabase env vars");
      return json(500, { error: "Server misconfigured" });
    }

    if (!encryptionKey) {
      console.error("[integracoes-config] ENCRYPTION_KEY not configured");
      return json(500, { error: "Encryption not configured" });
    }

    const derivedKey = deriveKey(encryptionKey);
    console.log("[integracoes-config] Encryption key derived successfully");

    const token = authHeader.replace("Bearer ", "");

    // 1) Validar JWT e obter userId
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      console.warn("[integracoes-config] Invalid token", claimsError);
      return json(401, { error: "Unauthorized" });
    }

    const userId = claimsData.claims.sub;

    // 2) Parse payload
    const payload = (await req
      .json()
      .catch(() => null)) as IntegracaoPayload | null;
    if (!payload) return json(400, { error: "Invalid JSON body" });
    if (!["create_integracao", "update_integracao"].includes(payload.action)) {
      return json(400, { error: "Invalid action" });
    }

    // Criar cliente admin
    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    // Distribuir para o handler apropriado
    if (payload.action === "create_integracao") {
      return await handleCreateIntegracao(
        payload as CreateIntegracaoPayload,
        userId,
        derivedKey,
        supabaseAdmin
      );
    } else if (payload.action === "update_integracao") {
      return await handleUpdateIntegracao(
        payload as UpdateIntegracaoPayload,
        userId,
        derivedKey,
        supabaseAdmin
      );
    }

    return json(400, { error: "Invalid action" });
  } catch (e: unknown) {
    console.error("[integracoes-config] Unhandled error", e);
    return json(500, { error: "Internal server error" });
  }
});
