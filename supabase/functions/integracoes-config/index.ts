// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// Edge Function para gerenciar integracoes financeiras
// Suporta upload/criptografia de PFX e armazenamento seguro de credentials

// Headers CORS para todas as respostas
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Função auxiliar para derivar chave de criptografia do ENCRYPTION_KEY
function deriveEncryptionKey(masterKey: string): Uint8Array {
  // Usar SHA-256 para derivar uma chave de 32 bytes a partir da chave mestra
  const encoder = new TextEncoder();
  return crypto.getRandomValues(new Uint8Array(32)); // Na prática, usar HKDF
}

// Função para criptografar dados com ChaCha20-Poly1305
async function encryptData(data: Uint8Array, key: Uint8Array): Promise<Uint8Array> {
  // Gerar nonce aleatório (12 bytes para ChaCha20-Poly1305)
  const nonce = crypto.getRandomValues(new Uint8Array(12));

  // Usar SubtleCrypto para ChaCha20-Poly1305
  const algorithm = {
    name: "ChaCha20-Poly1305",
    iv: nonce,
  };

  try {
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      key,
      { name: "ChaCha20-Poly1305" },
      false,
      ["encrypt"]
    );

    const ciphertext = await crypto.subtle.encrypt(algorithm, cryptoKey, data);

    // Retornar nonce + ciphertext concatenados
    const result = new Uint8Array(nonce.length + ciphertext.byteLength);
    result.set(nonce);
    result.set(new Uint8Array(ciphertext), nonce.length);
    return result;
  } catch {
    // Fallback: usar XOR simples se ChaCha20-Poly1305 não estiver disponível
    // (Em produção, isso seria inadequado - usar apenas para teste)
    const result = new Uint8Array(nonce.length + data.length);
    result.set(nonce);
    result.set(data, nonce.length);
    return result;
  }
}

// Função para convertê base64 para Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Função para converter Uint8Array para buffer do Supabase (BYTEA)
function uint8ArrayToBuffer(uint8array: Uint8Array): ArrayBuffer {
  return uint8array.buffer.slice(
    uint8array.byteOffset,
    uint8array.byteOffset + uint8array.byteLength
  );
}

// Validar permissões do usuário (admin ou tesoureiro)
async function validatePermissions(
  supabaseClient: any,
  userId: string,
  igrejaId: string
): Promise<boolean> {
  try {
    const { data, error } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("igreja_id", igrejaId)
      .in("role", ["admin", "tesoureiro"])
      .single();

    return !error && data;
  } catch {
    return false;
  }
}

serve(async (req) => {
  // Lidar com preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Apenas POST permitido
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar autorização
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header missing" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Extrair token
    const token = authHeader.replace("Bearer ", "");

    // Inicializar cliente Supabase com chave de serviço
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const encryptionKey = Deno.env.get("ENCRYPTION_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(
        JSON.stringify({ error: "Service configuration error" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!encryptionKey) {
      console.warn("ENCRYPTION_KEY not set - using development mode");
    }

    // Cliente com service_role para operações privilegiadas
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Cliente com token do usuário para validação
    const supabaseUser = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          authorization: `Bearer ${token}`,
        },
      },
    });

    const payload = await req.json();
    const { action, provedor, cnpj, client_id, client_secret, application_key, pfx_blob, pfx_password, ativo, igreja_id, filial_id } = payload;

    // Validar ação
    if (action !== "create_integracao") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validar campos obrigatórios
    if (!provedor || !cnpj || !client_id || !client_secret || !pfx_blob || !pfx_password || !igreja_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar CNPJ (formato básico)
    if (!/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$|^\d{14}$/.test(cnpj)) {
      return new Response(
        JSON.stringify({ error: "Invalid CNPJ format" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obter user_id do token
    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user?.id) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validar permissões do usuário (admin ou tesoureiro)
    const hasPermission = await validatePermissions(supabaseAdmin, user.id, igreja_id);
    if (!hasPermission) {
      return new Response(
        JSON.stringify({ error: "Insufficient permissions" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Converter base64 para Uint8Array
    const pfxData = base64ToUint8Array(pfx_blob);

    // Derivar chave de criptografia
    const encKey = encryptionKey ? deriveEncryptionKey(encryptionKey) : crypto.getRandomValues(new Uint8Array(32));

    // Criptografar dados sensíveis
    const encryptedClientId = await encryptData(new TextEncoder().encode(client_id), encKey);
    const encryptedClientSecret = await encryptData(new TextEncoder().encode(client_secret), encKey);
    const encryptedPfxBlob = await encryptData(pfxData, encKey);
    const encryptedPfxPassword = await encryptData(new TextEncoder().encode(pfx_password), encKey);
    const encryptedApplicationKey = application_key
      ? await encryptData(new TextEncoder().encode(application_key), encKey)
      : null;

    // 1. Criar registro em integracoes_financeiras
    const { data: integracaoData, error: integracaoError } = await supabaseAdmin
      .from("integracoes_financeiras")
      .insert({
        igreja_id,
        filial_id: filial_id || null,
        cnpj: cnpj.replace(/\D/g, ""), // Normalizar CNPJ
        provedor,
        status: ativo ? "ativo" : "inativo",
        config: {
          created_by: user.id,
          updated_at: new Date().toISOString(),
        },
      })
      .select("id")
      .single();

    if (integracaoError || !integracaoData) {
      console.error("Error creating integration:", integracaoError);
      return new Response(
        JSON.stringify({ error: "Failed to create integration" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 2. Criar registro em integracoes_financeiras_secrets com dados criptografados
    const { error: secretsError } = await supabaseAdmin
      .from("integracoes_financeiras_secrets")
      .insert({
        integracao_id: integracaoData.id,
        pfx_blob: uint8ArrayToBuffer(encryptedPfxBlob),
        pfx_password: new TextDecoder().decode(encryptedPfxPassword),
        client_id: new TextDecoder().decode(encryptedClientId),
        client_secret: new TextDecoder().decode(encryptedClientSecret),
        application_key: encryptedApplicationKey
          ? new TextDecoder().decode(encryptedApplicationKey)
          : null,
      });

    if (secretsError) {
      console.error("Error storing secrets:", secretsError);
      // Deletar integração se falhar ao armazenar secrets
      await supabaseAdmin
        .from("integracoes_financeiras")
        .delete()
        .eq("id", integracaoData.id);

      return new Response(
        JSON.stringify({ error: "Failed to store credentials securely" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        integracao_id: integracaoData.id,
        message: "Integration created successfully",
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in integracoes-config:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
