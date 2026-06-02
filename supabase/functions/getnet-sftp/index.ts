// supabase/functions/getnet-sftp/index.ts
// Edge function para SFTP de provedores (Getnet etc.).
// Reaproveita credenciais já criptografadas em integracoes_financeiras_secrets:
//   client_id      -> SFTP username
//   client_secret  -> SFTP password
//   application_key-> SFTP host
// Config não-sensível em integracoes_financeiras.config.sftp = {
//   port, path, file_pattern, layout, conta_id
// }
//
// Actions:
//   - test_connection  : conecta, lista path/raiz, retorna contagem
//   - list_files       : lista arquivos do path configurado
//   - import_extrato   : baixa arquivo mais recente, parseia e insere em extratos_bancarios
//
// Toda execução é registrada em public.integracoes_execucoes_log para auditoria.

import { createClient } from "npm:@supabase/supabase-js@2";
import nacl from "npm:tweetnacl@1.0.3";
import SftpClient from "npm:ssh2-sftp-client@10.0.3";
import Papa from "npm:papaparse@5.4.1";

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

// ==================== AUDIT LOG ====================

type LogPatch = {
  status?: "success" | "error" | "partial" | "running";
  arquivo_nome?: string | null;
  arquivo_tamanho?: number | null;
  arquivo_modified_at?: string | null;
  total_recebido?: number | null;
  total_inserido?: number | null;
  total_ignorado?: number | null;
  erro_mensagem?: string | null;
  erro_stack?: string | null;
  metadata?: Record<string, unknown>;
};

async function startLog(
  supabaseAdmin: any,
  payload: {
    integracao_id: string;
    igreja_id: string;
    filial_id: string | null;
    provedor: string;
    acao: string;
    created_by: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("integracoes_execucoes_log")
      .insert({
        integracao_id: payload.integracao_id,
        igreja_id: payload.igreja_id,
        filial_id: payload.filial_id,
        provedor: payload.provedor,
        acao: payload.acao,
        status: "running",
        created_by: payload.created_by,
        metadata: payload.metadata ?? {},
      })
      .select("id")
      .single();
    if (error) {
      console.error("[getnet-sftp] startLog error", error);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.error("[getnet-sftp] startLog exception", e);
    return null;
  }
}

async function finishLog(
  supabaseAdmin: any,
  logId: string | null,
  startedAt: number,
  patch: LogPatch
) {
  if (!logId) return;
  try {
    const finishedAt = new Date();
    await supabaseAdmin
      .from("integracoes_execucoes_log")
      .update({
        ...patch,
        finalizado_em: finishedAt.toISOString(),
        duracao_ms: Date.now() - startedAt,
      })
      .eq("id", logId);
  } catch (e) {
    console.error("[getnet-sftp] finishLog exception", e);
  }
}

// ==================== PARSERS ====================

function brDateToISO(s: string): string | null {
  const m = s.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  const m2 = s.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m2) return `${m2[1]}-${m2[2]}-${m2[3]}`;
  return null;
}

function brValorToNumber(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return v;
  const cleaned = String(v)
    .replace(/[R$\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

type ParsedRow = {
  data_transacao: string;
  descricao: string;
  valor: number;
  numero_documento: string | null;
  tipo: "credito" | "debito";
  external_id: string;
};

function pickField(row: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    for (const rk of Object.keys(row)) {
      if (rk.toLowerCase().trim() === k.toLowerCase()) {
        const v = row[rk];
        if (v != null && String(v).trim() !== "") return String(v);
      }
    }
  }
  return null;
}

function parseSettlementV1(rows: Record<string, unknown>[]): ParsedRow[] {
  const out: ParsedRow[] = [];
  for (const row of rows) {
    const dataRaw =
      pickField(row, [
        "Data de Venda",
        "data_venda",
        "Data Venda",
        "Data da Venda",
        "Data",
      ]) ?? "";
    const data = brDateToISO(dataRaw);
    if (!data) continue;

    const nsu = pickField(row, ["NSU", "nsu", "Nsu"]);
    const autorizacao = pickField(row, [
      "Código de Autorização",
      "Codigo de Autorizacao",
      "autorizacao",
      "Authorization Code",
    ]);
    const bandeira = pickField(row, ["Bandeira", "bandeira", "Brand"]) ?? "";
    const valor =
      brValorToNumber(pickField(row, ["Valor Líquido", "Valor Liquido"])) ??
      brValorToNumber(pickField(row, ["Valor Bruto", "Valor", "Amount"]));
    if (valor == null || valor === 0) continue;

    const doc = nsu ?? autorizacao;
    const descricaoBase = bandeira ? `${bandeira}`.trim() : "Getnet";
    const descricao = doc
      ? `${descricaoBase} - NSU ${doc}`.trim()
      : descricaoBase;
    const tipo: "credito" | "debito" = valor < 0 ? "debito" : "credito";
    const external_id = `getnet:${doc ?? `${data}:${valor}:${descricaoBase}`}`;

    out.push({
      data_transacao: data,
      descricao,
      valor: Math.abs(valor) * (tipo === "debito" ? -1 : 1),
      numero_documento: doc,
      tipo,
      external_id,
    });
  }
  return out;
}

function parseCSV(buf: Uint8Array): Record<string, unknown>[] {
  const text = new TextDecoder("utf-8").decode(buf);
  // autodetect delimiter (papaparse already does)
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    delimitersToGuess: [";", ",", "\t", "|"],
  });
  return (res.data || []).filter(
    (r) => r && typeof r === "object" && Object.keys(r).length > 0
  );
}

// ==================== HANDLER ====================

type Payload = {
  action: "test_connection" | "list_files" | "import_extrato";
  integracao_id: string;
  arquivo_nome?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const startedAt = Date.now();
  let logId: string | null = null;
  let supabaseAdmin: any = null;
  let baseLogCtx: {
    integracao_id: string;
    igreja_id: string;
    filial_id: string | null;
    provedor: string;
    acao: string;
    created_by: string | null;
  } | null = null;

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
    if (
      !["test_connection", "list_files", "import_extrato"].includes(
        payload.action
      )
    ) {
      return json(400, { error: "Invalid action" });
    }

    supabaseAdmin = createClient(supabaseUrl, serviceKey);
    const derivedKey = deriveKey(encryptionKey);

    const { data: integracao, error: intErr } = await supabaseAdmin
      .from("integracoes_financeiras")
      .select("id, igreja_id, filial_id, provedor, tipo_auth, config")
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

    baseLogCtx = {
      integracao_id: integracao.id,
      igreja_id: integracao.igreja_id,
      filial_id: integracao.filial_id ?? null,
      provedor: integracao.provedor,
      acao: payload.action,
      created_by: userId,
    };
    logId = await startLog(supabaseAdmin, {
      ...baseLogCtx,
      metadata: { requested_file: payload.arquivo_nome ?? null },
    });

    const { data: secrets, error: secErr } = await supabaseAdmin
      .from("integracoes_financeiras_secrets")
      .select("client_id, client_secret, application_key")
      .eq("integracao_id", payload.integracao_id)
      .maybeSingle();

    if (secErr || !secrets) {
      await finishLog(supabaseAdmin, logId, startedAt, {
        status: "error",
        erro_mensagem: "Credentials not found",
      });
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
      await finishLog(supabaseAdmin, logId, startedAt, {
        status: "error",
        erro_mensagem: "SFTP credentials incomplete or could not be decrypted",
      });
      return json(200, {
        success: false,
        error: "SFTP credentials incomplete or could not be decrypted",
      });
    }

    const cfg = (integracao.config ?? {}) as Record<string, unknown>;
    const sftpCfg = (cfg.sftp ?? {}) as {
      port?: string | number;
      path?: string;
      file_pattern?: string;
      layout?: string;
      conta_id?: string;
    };
    const port = sftpCfg.port ? Number(sftpCfg.port) : 22;
    const path = sftpCfg.path || "/";
    const filePattern = sftpCfg.file_pattern || ".csv";
    const layout = sftpCfg.layout || "settlement_v1";
    const contaId = sftpCfg.conta_id || null;

    console.log(
      `[getnet-sftp] action=${payload.action} ${host}:${port} as ${username} path=${path}`
    );

    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host,
        port,
        username,
        password,
        readyTimeout: 20000,
      });

      // ===== TEST_CONNECTION =====
      if (payload.action === "test_connection") {
        const listing = await sftp.list(path).catch(async () => sftp.list("/"));
        const files = (listing as any[]).map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          modified: f.modifyTime,
        }));
        await sftp.end();
        await finishLog(supabaseAdmin, logId, startedAt, {
          status: "success",
          total_recebido: files.length,
          metadata: { host, port, path },
        });
        return json(200, {
          success: true,
          host,
          port,
          path,
          files_count: files.length,
        });
      }

      // ===== LIST_FILES =====
      if (payload.action === "list_files") {
        const listing = await sftp.list(path);
        const files = (listing as any[]).map((f) => ({
          name: f.name,
          type: f.type,
          size: f.size,
          modified: f.modifyTime,
        }));
        await sftp.end();
        await finishLog(supabaseAdmin, logId, startedAt, {
          status: "success",
          total_recebido: files.length,
          metadata: { host, port, path },
        });
        return json(200, { success: true, host, port, path, files });
      }

      // ===== IMPORT_EXTRATO =====
      if (!contaId) {
        await sftp.end();
        await finishLog(supabaseAdmin, logId, startedAt, {
          status: "error",
          erro_mensagem:
            "config.sftp.conta_id não configurado — defina a conta bancária na integração",
        });
        return json(200, {
          success: false,
          error:
            "Conta bancária não configurada nesta integração (config.sftp.conta_id ausente).",
        });
      }

      const listing = (await sftp.list(path)) as any[];
      const patternLower = filePattern.toLowerCase().replace(/^\*/, "");
      const candidates = listing
        .filter((f) => f.type === "-")
        .filter((f) =>
          payload.arquivo_nome
            ? f.name === payload.arquivo_nome
            : f.name.toLowerCase().endsWith(patternLower)
        )
        .sort((a, b) => (b.modifyTime ?? 0) - (a.modifyTime ?? 0));

      if (candidates.length === 0) {
        await sftp.end();
        await finishLog(supabaseAdmin, logId, startedAt, {
          status: "error",
          erro_mensagem: `Nenhum arquivo encontrado em ${path} (pattern=${filePattern})`,
          metadata: { host, port, path, file_pattern: filePattern },
        });
        return json(200, {
          success: false,
          error: `Nenhum arquivo encontrado em ${path}`,
        });
      }

      const target = candidates[0];
      const remotePath = path.endsWith("/")
        ? `${path}${target.name}`
        : `${path}/${target.name}`;

      const buf = (await sftp.get(remotePath)) as Uint8Array;
      await sftp.end();

      const rows = parseCSV(buf);
      let parsed: ParsedRow[] = [];
      if (layout === "settlement_v1") {
        parsed = parseSettlementV1(rows);
      } else {
        await finishLog(supabaseAdmin, logId, startedAt, {
          status: "error",
          arquivo_nome: target.name,
          arquivo_tamanho: target.size ?? null,
          arquivo_modified_at: target.modifyTime
            ? new Date(target.modifyTime).toISOString()
            : null,
          total_recebido: rows.length,
          erro_mensagem: `Layout desconhecido: ${layout}`,
        });
        return json(200, {
          success: false,
          error: `Layout desconhecido: ${layout}`,
        });
      }

      // Insere usando upsert para dedupe via (conta_id, external_id)
      let inserted = 0;
      let ignored = 0;
      if (parsed.length > 0) {
        const inserts = parsed.map((p) => ({
          conta_id: contaId,
          igreja_id: integracao.igreja_id,
          filial_id: integracao.filial_id ?? null,
          data_transacao: p.data_transacao,
          descricao: p.descricao,
          valor: p.valor,
          numero_documento: p.numero_documento,
          tipo: p.tipo,
          external_id: p.external_id,
          origem: "getnet_sftp",
          reconciliado: false,
        }));

        const { data: upserted, error: upErr } = await supabaseAdmin
          .from("extratos_bancarios")
          .upsert(inserts, {
            onConflict: "conta_id,external_id",
            ignoreDuplicates: true,
          })
          .select("id");

        if (upErr) {
          await finishLog(supabaseAdmin, logId, startedAt, {
            status: "error",
            arquivo_nome: target.name,
            arquivo_tamanho: target.size ?? null,
            arquivo_modified_at: target.modifyTime
              ? new Date(target.modifyTime).toISOString()
              : null,
            total_recebido: parsed.length,
            erro_mensagem: `Erro ao inserir extratos: ${upErr.message}`,
            metadata: { host, port, path, file_pattern: filePattern, layout },
          });
          return json(200, {
            success: false,
            error: `Erro ao inserir extratos: ${upErr.message}`,
          });
        }
        inserted = upserted?.length ?? 0;
        ignored = parsed.length - inserted;
      }

      await finishLog(supabaseAdmin, logId, startedAt, {
        status: "success",
        arquivo_nome: target.name,
        arquivo_tamanho: target.size ?? null,
        arquivo_modified_at: target.modifyTime
          ? new Date(target.modifyTime).toISOString()
          : null,
        total_recebido: parsed.length,
        total_inserido: inserted,
        total_ignorado: ignored,
        metadata: {
          host,
          port,
          path,
          file_pattern: filePattern,
          layout,
          conta_id: contaId,
          csv_rows: rows.length,
        },
      });

      return json(200, {
        success: true,
        arquivo: target.name,
        total_recebido: parsed.length,
        total_inserido: inserted,
        total_ignorado: ignored,
      });
    } catch (sftpErr: any) {
      console.error("[getnet-sftp] SFTP error", sftpErr);
      try {
        await sftp.end();
      } catch (_) {
        /* ignore */
      }
      await finishLog(supabaseAdmin, logId, startedAt, {
        status: "error",
        erro_mensagem: sftpErr?.message || "SFTP error",
        erro_stack:
          typeof sftpErr?.stack === "string" ? sftpErr.stack.slice(0, 4000) : null,
      });
      return json(200, {
        success: false,
        error: sftpErr?.message || "SFTP connection failed",
      });
    }
  } catch (e: any) {
    console.error("[getnet-sftp] Unhandled error", e);
    if (supabaseAdmin && logId) {
      await finishLog(supabaseAdmin, logId, startedAt, {
        status: "error",
        erro_mensagem: e?.message || "Unhandled error",
        erro_stack:
          typeof e?.stack === "string" ? e.stack.slice(0, 4000) : null,
      });
    }
    return json(500, { error: "Internal server error" });
  }
});
