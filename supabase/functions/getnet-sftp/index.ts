// supabase/functions/getnet-sftp/index.ts
// Edge function para conexão SFTP com provedores (Getnet etc.).
// Reaproveita credenciais já criptografadas em integracoes_financeiras_secrets:
//   client_id      -> SFTP username
//   client_secret  -> SFTP password
//   application_key-> SFTP host
// Config não-sensível em integracoes_financeiras.config.sftp = { port, path }
//
// Actions:
//   - test_connection  : conecta, lista raiz e retorna contagem de arquivos
//   - list_files       : conecta e retorna lista do path configurado

import { createClient } from "npm:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import SftpClient from "npm:ssh2-sftp-client@10.0.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ==================== DECRYPT (XSalsa20-Poly1305) ====================

function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++)
    bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function deriveKey(masterKey: string): Uint8Array {
  const trimmed = masterKey.trim();
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(trimmed.substring(i * 2, i * 2 + 2), 16);
    }
    return bytes;
  }
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
  const encoded = new TextEncoder().encode(trimmed);
  const key = new Uint8Array(32);
  key.set(encoded.slice(0, 32));
  return key;
}

function decryptData(combinedBase64: string, key: Uint8Array): string | null {
  try {
    const combined = base64ToUint8Array(combinedBase64);
    const nonce = combined.slice(0, nacl.secretbox.nonceLength);
    const ciphertext = combined.slice(nacl.secretbox.nonceLength);
    const plain = nacl.secretbox.open(ciphertext, nonce, key);
    if (!plain) return null;
    return new TextDecoder().decode(plain);
  } catch (e) {
    console.error("[getnet-sftp] decrypt error", e);
    return null;
  }
}

// ==================== PERMISSIONS ====================

async function validatePermissions(
  supabaseAdmin: any,
  userId: string,
  igrejaId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role, igreja_id")
    .eq("user_id", userId)
    .in("role", ["super_admin", "admin", "admin_igreja", "tesoureiro"]);

  if (error || !data || data.length === 0) return false;
  if (data.some((r: any) => r.role === "super_admin")) return true;
  return data.some(
    (r: any) =>
      r.igreja_id === igrejaId &&
      ["admin", "admin_igreja", "tesoureiro"].includes(r.role)
  );
}

// ==================== HANDLER ====================

type Payload = {
  action: "test_connection" | "list_files";
  integracao_id: string;
};

Deno.serve(async (req) => {
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

    if (!supabaseUrl || !supabaseAnonKey || !serviceKey || !encryptionKey) {
      console.error("[getnet-sftp] Server misconfigured");
      return json(500, { error: "Server misconfigured" });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } =
      await supabaseUser.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json(401, { error: "Unauthorized" });
    }
    const userId = claimsData.claims.sub;

    const payload = (await req.json().catch(() => null)) as Payload | null;
    if (!payload || !payload.integracao_id || !payload.action) {
      return json(400, { error: "Invalid payload" });
    }
    if (!["test_connection", "list_files"].includes(payload.action)) {
      return json(400, { error: "Invalid action" });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const derivedKey = deriveKey(encryptionKey);

    // Carregar integração + secrets
    const { data: integracao, error: intErr } = await supabaseAdmin
      .from("integracoes_financeiras")
      .select("id, igreja_id, provedor, tipo_auth, config")
      .eq("id", payload.integracao_id)
      .maybeSingle();

    if (intErr || !integracao) {
      return json(404, { error: "Integration not found" });
    }

    const hasPermission = await validatePermissions(
      supabaseAdmin,
      userId,
      integracao.igreja_id
    );
    if (!hasPermission) return json(403, { error: "Insufficient permissions" });

    if (integracao.tipo_auth !== "sftp") {
      return json(200, {
        success: false,
        error: "Integration is not configured as SFTP",
      });
    }

    const { data: secrets, error: secErr } = await supabaseAdmin
      .from("integracoes_financeiras_secrets")
      .select("client_id, client_secret, application_key")
      .eq("integracao_id", payload.integracao_id)
      .maybeSingle();

    if (secErr || !secrets) {
      return json(200, { success: false, error: "Credentials not found" });
    }

    const username = secrets.client_id
      ? decryptData(secrets.client_id, derivedKey)
      : null;
    const password = secrets.client_secret
      ? decryptData(secrets.client_secret, derivedKey)
      : null;
    const host = secrets.application_key
      ? decryptData(secrets.application_key, derivedKey)
      : null;

    if (!username || !password || !host) {
      return json(200, {
        success: false,
        error: "SFTP credentials incomplete or could not be decrypted",
      });
    }

    const cfg = (integracao.config ?? {}) as Record<string, unknown>;
    const sftpCfg = (cfg.sftp ?? {}) as { port?: string | number; path?: string };
    const port = sftpCfg.port ? Number(sftpCfg.port) : 22;
    const path = sftpCfg.path || "/";

    console.log(
      `[getnet-sftp] Connecting to ${host}:${port} as ${username} (path=${path})`
    );

    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host,
        port,
        username,
        password,
        readyTimeout: 15000,
      });

      const listing = await sftp.list(path).catch(async (e: unknown) => {
        // se o path falhar, tenta raiz como fallback de diagnóstico
        console.warn(
          `[getnet-sftp] list("${path}") failed, trying "/" as fallback`,
          e
        );
        return await sftp.list("/");
      });

      const files = (listing as any[]).map((f) => ({
        name: f.name,
        type: f.type, // "-" arquivo, "d" diretório
        size: f.size,
        modified: f.modifyTime,
      }));

      await sftp.end();

      if (payload.action === "test_connection") {
        return json(200, {
          success: true,
          host,
          port,
          path,
          files_count: files.length,
        });
      }

      return json(200, {
        success: true,
        host,
        port,
        path,
        files,
      });
    } catch (sftpErr: any) {
      console.error("[getnet-sftp] SFTP error", sftpErr);
      try {
        await sftp.end();
      } catch (_) {
        /* ignore */
      }
      return json(200, {
        success: false,
        error: sftpErr?.message || "SFTP connection failed",
      });
    }
  } catch (e: unknown) {
    console.error("[getnet-sftp] Unhandled error", e);
    return json(500, { error: "Internal server error" });
  }
});
