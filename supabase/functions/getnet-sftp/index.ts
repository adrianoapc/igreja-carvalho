// supabase/functions/getnet-sftp/index.ts
// Edge function para SFTP de provedores (Getnet etc.).
// Reaproveita credenciais já criptografadas em integracoes_financeiras_secrets:
//   client_id      -> SFTP username
//   client_secret  -> SFTP password
//   application_key-> SFTP host
// Config não-sensível em integracoes_financeiras.config.sftp = {
//   port, path, file_pattern, file_pattern_regex, layout, conta_id
// }
//
// Actions:
//   - test_connection  : conecta, lista path/raiz, retorna contagem
//   - list_files       : lista arquivos do path configurado
//   - import_extrato   : baixa arquivo(s) e processa conforme layout
//
// Layouts suportados:
//   - settlement_v1          : CSV settlement (legado)
//   - extrato_eletronico_v10 : TXT posicional 400b (Getnet Extrato Eletrônico v10.1)
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

const RAW_BUCKET = "getnet-raw-files";

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
    arquivo_nome?: string | null;
    arquivo_tamanho?: number | null;
    arquivo_modified_at?: string | null;
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
        arquivo_nome: payload.arquivo_nome ?? null,
        arquivo_tamanho: payload.arquivo_tamanho ?? null,
        arquivo_modified_at: payload.arquivo_modified_at ?? null,
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
    await supabaseAdmin
      .from("integracoes_execucoes_log")
      .update({
        ...patch,
        finalizado_em: new Date().toISOString(),
        duracao_ms: Date.now() - startedAt,
      })
      .eq("id", logId);
  } catch (e) {
    console.error("[getnet-sftp] finishLog exception", e);
  }
}

// ==================== HELPERS ====================

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

// "Hoje" em America/Sao_Paulo → YYYY-MM-DD
function todayBRT(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // already YYYY-MM-DD
}

// Converte YYYY-MM-DD -> DDMMAAAA
function isoToDDMMYYYY(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}${m}${y}`;
}

// ==================== CSV PARSER (legado settlement_v1) ====================

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
  const res = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: true,
    delimitersToGuess: [";", ",", "\t", "|"],
  });
  return (res.data || []).filter(
    (r) => r && typeof r === "object" && Object.keys(r).length > 0
  );
}

// ==================== PARSER POSICIONAL v10.1 ====================

type ResumoRow = {
  codigo_produto: string;
  forma_captura: string;
  rv: string;
  data_rv: string; // ISO
  valor_bruto: number;
  valor_liquido: number; // já com sinal
  sinal: string;
  raw_line: string;
};

type AnaliticoRow = {
  rv: string;
  nsu_cv: string;
  cartao_truncado: string;
  valor_transacao: number;
  codigo_autorizacao: string;
  forma_captura: string;
  status: string;
  raw_line: string;
};

function f(line: string, ini: number, fim: number): string {
  return line.slice(ini - 1, fim).trim();
}
function money(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) ? n / 100 : 0;
}
function dateFromDDMMYYYY(s: string): string | null {
  if (!/^\d{8}$/.test(s)) return null;
  const dd = s.slice(0, 2);
  const mm = s.slice(2, 4);
  const yyyy = s.slice(4, 8);
  return `${yyyy}-${mm}-${dd}`;
}

type ParsePosicionalResult = {
  resumos: ResumoRow[];
  analiticos: AnaliticoRow[];
  linhas_invalidas: number;
  total_linhas: number;
};

function parseExtratoEletronicoV10(text: string): ParsePosicionalResult {
  const lines = text.split(/\r?\n/);
  const resumos: ResumoRow[] = [];
  const analiticos: AnaliticoRow[] = [];
  let linhas_invalidas = 0;
  let total_linhas = 0;

  for (const rawLine of lines) {
    if (!rawLine || rawLine.length === 0) continue;
    const tipo = rawLine[0];
    if (tipo === "0" || tipo === "9") continue; // header/trailer
    if (tipo !== "1" && tipo !== "2") continue; // outros não suportados

    total_linhas++;
    if (rawLine.length < 400) {
      linhas_invalidas++;
      continue;
    }

    try {
      if (tipo === "1") {
        const data_rv = dateFromDDMMYYYY(f(rawLine, 31, 38));
        const rv = f(rawLine, 22, 30);
        if (!data_rv || !rv) {
          linhas_invalidas++;
          continue;
        }
        const valor_bruto = money(f(rawLine, 85, 96));
        const valor_liq_abs = money(f(rawLine, 97, 108));
        const sinal = f(rawLine, 286, 286);
        const valor_liquido = sinal === "-" ? -valor_liq_abs : valor_liq_abs;
        resumos.push({
          codigo_produto: f(rawLine, 17, 18),
          forma_captura: f(rawLine, 19, 21),
          rv,
          data_rv,
          valor_bruto,
          valor_liquido,
          sinal,
          raw_line: rawLine,
        });
      } else if (tipo === "2") {
        const rv = f(rawLine, 17, 25);
        const nsu_cv = f(rawLine, 26, 37);
        if (!rv || !nsu_cv) {
          linhas_invalidas++;
          continue;
        }
        analiticos.push({
          rv,
          nsu_cv,
          cartao_truncado: f(rawLine, 52, 70),
          valor_transacao: money(f(rawLine, 71, 82)),
          codigo_autorizacao: f(rawLine, 131, 140),
          forma_captura: f(rawLine, 141, 143),
          status: f(rawLine, 144, 144),
          raw_line: rawLine,
        });
      }
    } catch (_e) {
      linhas_invalidas++;
    }
  }

  return { resumos, analiticos, linhas_invalidas, total_linhas };
}

async function upsertChunks<T>(
  supabaseAdmin: any,
  table: string,
  rows: T[],
  onConflict: string,
  chunkSize = 500
): Promise<{ inserted: number; ignored: number; error: string | null }> {
  let inserted = 0;
  if (rows.length === 0) return { inserted: 0, ignored: 0, error: null };
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { data, error } = await supabaseAdmin
      .from(table)
      .upsert(chunk, { onConflict, ignoreDuplicates: true })
      .select("id");
    if (error) return { inserted, ignored: 0, error: error.message };
    inserted += data?.length ?? 0;
  }
  return { inserted, ignored: rows.length - inserted, error: null };
}

// ==================== HANDLER ====================

type Payload = {
  action: "test_connection" | "list_files" | "import_extrato";
  integracao_id: string;
  arquivo_nome?: string;
  data_referencia?: string; // YYYY-MM-DD (override do "hoje")
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
      created_by: userId,
    };

    // ===== Credenciais =====
    const { data: secrets, error: secErr } = await supabaseAdmin
      .from("integracoes_financeiras_secrets")
      .select("client_id, client_secret, application_key")
      .eq("integracao_id", payload.integracao_id)
      .maybeSingle();

    if (secErr || !secrets) {
      logId = await startLog(supabaseAdmin, { ...baseLogCtx, acao: payload.action });
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
      logId = await startLog(supabaseAdmin, { ...baseLogCtx, acao: payload.action });
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
      file_pattern_regex?: string;
      layout?: string;
      conta_id?: string;
    };
    const port = sftpCfg.port ? Number(sftpCfg.port) : 22;
    const path = sftpCfg.path || "/";
    const filePattern = sftpCfg.file_pattern || ".csv";
    const layout = sftpCfg.layout || "settlement_v1";
    const contaId = sftpCfg.conta_id || null;

    console.log(
      `[getnet-sftp] action=${payload.action} layout=${layout} ${host}:${port} as ${username} path=${path}`
    );

    // ===== test_connection / list_files (caminho simples) =====
    if (payload.action === "test_connection" || payload.action === "list_files") {
      logId = await startLog(supabaseAdmin, {
        ...baseLogCtx,
        acao: payload.action,
        metadata: { host, port, path },
      });
      const sftp = new SftpClient();
      try {
        await sftp.connect({ host, port, username, password, readyTimeout: 20000 });
        const listing =
          payload.action === "test_connection"
            ? await sftp.list(path).catch(async () => sftp.list("/"))
            : await sftp.list(path);
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
          ...(payload.action === "list_files" ? { files } : {}),
        });
      } catch (sftpErr: any) {
        try { await sftp.end(); } catch (_) { /* ignore */ }
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
    }

    // ===== import_extrato =====
    if (!contaId) {
      logId = await startLog(supabaseAdmin, { ...baseLogCtx, acao: "import_extrato" });
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

    // Despacha por layout
    if (layout === "settlement_v1") {
      return await runSettlementV1({
        supabaseAdmin,
        baseLogCtx,
        startedAt,
        host,
        port,
        path,
        username,
        password,
        filePattern,
        contaId,
        integracao,
        requestedFile: payload.arquivo_nome ?? null,
      });
    }

    if (layout === "extrato_eletronico_v10") {
      return await runExtratoEletronicoV10({
        supabaseAdmin,
        baseLogCtx,
        startedAt,
        host,
        port,
        path,
        username,
        password,
        filePatternRegex: sftpCfg.file_pattern_regex || null,
        contaId,
        integracao,
        dataReferencia: payload.data_referencia || todayBRT(),
        requestedFile: payload.arquivo_nome ?? null,
      });
    }

    logId = await startLog(supabaseAdmin, { ...baseLogCtx, acao: "import_extrato" });
    await finishLog(supabaseAdmin, logId, startedAt, {
      status: "error",
      erro_mensagem: `Layout desconhecido: ${layout}`,
    });
    return json(200, { success: false, error: `Layout desconhecido: ${layout}` });
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

// ==================== runner: settlement_v1 (CSV legado) ====================

async function runSettlementV1(args: {
  supabaseAdmin: any;
  baseLogCtx: any;
  startedAt: number;
  host: string;
  port: number;
  path: string;
  username: string;
  password: string;
  filePattern: string;
  contaId: string;
  integracao: any;
  requestedFile: string | null;
}): Promise<Response> {
  const {
    supabaseAdmin, baseLogCtx, startedAt, host, port, path,
    username, password, filePattern, contaId, integracao, requestedFile,
  } = args;

  const logId = await startLog(supabaseAdmin, {
    ...baseLogCtx,
    acao: "import_extrato",
    metadata: { host, port, path, file_pattern: filePattern, layout: "settlement_v1" },
  });

  const sftp = new SftpClient();
  try {
    await sftp.connect({ host, port, username, password, readyTimeout: 20000 });

    const listing = (await sftp.list(path)) as any[];
    const patternLower = filePattern.toLowerCase().replace(/^\*/, "");
    const candidates = listing
      .filter((f) => f.type === "-")
      .filter((f) =>
        requestedFile
          ? f.name === requestedFile
          : f.name.toLowerCase().endsWith(patternLower)
      )
      .sort((a, b) => (b.modifyTime ?? 0) - (a.modifyTime ?? 0));

    if (candidates.length === 0) {
      await sftp.end();
      await finishLog(supabaseAdmin, logId, startedAt, {
        status: "error",
        erro_mensagem: `Nenhum arquivo encontrado em ${path} (pattern=${filePattern})`,
      });
      return json(200, { success: false, error: `Nenhum arquivo encontrado em ${path}` });
    }

    const target = candidates[0];
    const remotePath = path.endsWith("/") ? `${path}${target.name}` : `${path}/${target.name}`;
    const buf = (await sftp.get(remotePath)) as Uint8Array;
    await sftp.end();

    const rows = parseCSV(buf);
    const parsed = parseSettlementV1(rows);

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
      const { data: up, error: upErr } = await supabaseAdmin
        .from("extratos_bancarios")
        .upsert(inserts, { onConflict: "conta_id,external_id", ignoreDuplicates: true })
        .select("id");
      if (upErr) {
        await finishLog(supabaseAdmin, logId, startedAt, {
          status: "error",
          arquivo_nome: target.name,
          erro_mensagem: `Erro ao inserir extratos: ${upErr.message}`,
        });
        return json(200, { success: false, error: upErr.message });
      }
      inserted = up?.length ?? 0;
      ignored = parsed.length - inserted;
    }

    await finishLog(supabaseAdmin, logId, startedAt, {
      status: "success",
      arquivo_nome: target.name,
      arquivo_tamanho: target.size ?? null,
      arquivo_modified_at: target.modifyTime ? new Date(target.modifyTime).toISOString() : null,
      total_recebido: parsed.length,
      total_inserido: inserted,
      total_ignorado: ignored,
      metadata: { csv_rows: rows.length, layout: "settlement_v1" },
    });
    return json(200, {
      success: true,
      arquivo: target.name,
      total_recebido: parsed.length,
      total_inserido: inserted,
      total_ignorado: ignored,
    });
  } catch (sftpErr: any) {
    try { await sftp.end(); } catch (_) { /* ignore */ }
    await finishLog(supabaseAdmin, logId, startedAt, {
      status: "error",
      erro_mensagem: sftpErr?.message || "SFTP error",
      erro_stack: typeof sftpErr?.stack === "string" ? sftpErr.stack.slice(0, 4000) : null,
    });
    return json(200, { success: false, error: sftpErr?.message || "SFTP connection failed" });
  }
}

// ==================== runner: extrato_eletronico_v10 ====================

async function runExtratoEletronicoV10(args: {
  supabaseAdmin: any;
  baseLogCtx: any;
  startedAt: number;
  host: string;
  port: number;
  path: string;
  username: string;
  password: string;
  filePatternRegex: string | null;
  contaId: string;
  integracao: any;
  dataReferencia: string;
  requestedFile: string | null;
}): Promise<Response> {
  const {
    supabaseAdmin, baseLogCtx, startedAt, host, port, path,
    username, password, filePatternRegex, contaId, integracao,
    dataReferencia, requestedFile,
  } = args;

  // regex default: EEVD?_<algo>_DDMMAAAA.txt
  const defaultRegex = "^EEVD?_.+_(\\d{2})(\\d{2})(\\d{4})\\.txt$";
  const regexStr = filePatternRegex || defaultRegex;
  const fileRegex = new RegExp(regexStr, "i");
  const targetDDMMYYYY = isoToDDMMYYYY(dataReferencia);

  // ===== Log mestre =====
  const parentLogId = await startLog(supabaseAdmin, {
    ...baseLogCtx,
    acao: "import_extrato",
    metadata: {
      layout: "extrato_eletronico_v10",
      fase: "download",
      data_referencia: dataReferencia,
      host,
      port,
      path,
      file_pattern_regex: regexStr,
    },
  });

  // ===== FASE 1 — Download =====
  type ArquivoBaixado = {
    nome: string;
    storage_path: string;
    tamanho: number | null;
    modified_at: string | null;
    status: "baixado" | "erro_download" | "processado" | "erro_processamento";
    log_id?: string | null;
    erro?: string | null;
    totais?: {
      total_recebido: number;
      total_inserido: number;
      total_ignorado: number;
      resumos: number;
      analiticos: number;
      linhas_invalidas: number;
    };
  };

  const arquivos: ArquivoBaixado[] = [];

  const sftp = new SftpClient();
  try {
    await sftp.connect({ host, port, username, password, readyTimeout: 20000 });
    const listing = (await sftp.list(path)) as any[];

    const candidates = listing.filter((f) => {
      if (f.type !== "-") return false;
      if (requestedFile) return f.name === requestedFile;
      const m = fileRegex.exec(f.name);
      if (!m) return false;
      // Se a regex captura 3 grupos (DD, MM, AAAA), filtra por data alvo
      if (m.length >= 4) {
        const dd = m[1], mm = m[2], yyyy = m[3];
        return `${dd}${mm}${yyyy}` === targetDDMMYYYY;
      }
      return true; // regex custom sem grupos de data: aceita tudo que casa
    });

    for (const c of candidates) {
      const remotePath = path.endsWith("/") ? `${path}${c.name}` : `${path}/${c.name}`;
      const storagePath = `${integracao.igreja_id}/${integracao.id}/${dataReferencia}/${c.name}`;
      try {
        const buf = (await sftp.get(remotePath)) as Uint8Array;
        const blob = new Blob([buf], { type: "text/plain" });
        const { error: upErr } = await supabaseAdmin.storage
          .from(RAW_BUCKET)
          .upload(storagePath, blob, { upsert: true, contentType: "text/plain" });
        if (upErr) throw new Error(upErr.message);
        arquivos.push({
          nome: c.name,
          storage_path: storagePath,
          tamanho: c.size ?? null,
          modified_at: c.modifyTime ? new Date(c.modifyTime).toISOString() : null,
          status: "baixado",
        });
      } catch (dlErr: any) {
        arquivos.push({
          nome: c.name,
          storage_path: storagePath,
          tamanho: c.size ?? null,
          modified_at: c.modifyTime ? new Date(c.modifyTime).toISOString() : null,
          status: "erro_download",
          erro: dlErr?.message || String(dlErr),
        });
      }
    }
    await sftp.end();
  } catch (sftpErr: any) {
    try { await sftp.end(); } catch (_) { /* ignore */ }
    await finishLog(supabaseAdmin, parentLogId, startedAt, {
      status: "error",
      erro_mensagem: sftpErr?.message || "SFTP error",
      erro_stack: typeof sftpErr?.stack === "string" ? sftpErr.stack.slice(0, 4000) : null,
      metadata: {
        layout: "extrato_eletronico_v10",
        data_referencia: dataReferencia,
        fase: "download",
        arquivos_encontrados: 0,
      },
    });
    return json(200, { success: false, error: sftpErr?.message || "SFTP connection failed" });
  }

  if (arquivos.length === 0) {
    await finishLog(supabaseAdmin, parentLogId, startedAt, {
      status: "error",
      erro_mensagem: `Nenhum arquivo encontrado para ${dataReferencia} (regex=${regexStr}) em ${path}`,
      metadata: {
        layout: "extrato_eletronico_v10",
        data_referencia: dataReferencia,
        fase: "download",
        arquivos_encontrados: 0,
        path,
        regex: regexStr,
      },
    });
    return json(200, {
      success: false,
      error: `Nenhum arquivo encontrado para ${dataReferencia} em ${path}`,
    });
  }

  // ===== FASE 2 — Processamento por arquivo =====
  let totalRecebido = 0;
  let totalInserido = 0;
  let totalIgnorado = 0;
  const decoder = new TextDecoder("latin1");

  for (const arq of arquivos) {
    if (arq.status !== "baixado") continue;

    const childStarted = Date.now();
    const childLogId = await startLog(supabaseAdmin, {
      ...baseLogCtx,
      acao: "import_extrato_arquivo",
      arquivo_nome: arq.nome,
      arquivo_tamanho: arq.tamanho,
      arquivo_modified_at: arq.modified_at,
      metadata: {
        parent_log_id: parentLogId,
        storage_path: arq.storage_path,
        layout: "extrato_eletronico_v10",
        data_referencia: dataReferencia,
      },
    });
    arq.log_id = childLogId;

    try {
      // Baixa do bucket
      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from(RAW_BUCKET)
        .download(arq.storage_path);
      if (dlErr || !blob) {
        throw new Error(dlErr?.message || "Falha ao baixar do bucket");
      }
      const buf = new Uint8Array(await blob.arrayBuffer());
      const text = decoder.decode(buf);

      const { resumos, analiticos, linhas_invalidas, total_linhas } =
        parseExtratoEletronicoV10(text);

      // Persiste getnet_resumo
      const resumoRows = resumos.map((r) => ({
        integracao_id: integracao.id,
        igreja_id: integracao.igreja_id,
        filial_id: integracao.filial_id ?? null,
        arquivo_nome: arq.nome,
        codigo_produto: r.codigo_produto || null,
        forma_captura: r.forma_captura || null,
        rv: r.rv,
        data_rv: r.data_rv,
        valor_bruto: r.valor_bruto,
        valor_liquido: r.valor_liquido,
        sinal: r.sinal || null,
        raw_line: r.raw_line,
      }));
      const resRes = await upsertChunks(
        supabaseAdmin,
        "getnet_resumo",
        resumoRows,
        "integracao_id,rv,data_rv"
      );
      if (resRes.error) throw new Error(`getnet_resumo: ${resRes.error}`);

      // Persiste getnet_analitico
      const analiticoRows = analiticos.map((a) => ({
        integracao_id: integracao.id,
        igreja_id: integracao.igreja_id,
        filial_id: integracao.filial_id ?? null,
        arquivo_nome: arq.nome,
        rv: a.rv,
        nsu_cv: a.nsu_cv,
        cartao_truncado: a.cartao_truncado || null,
        valor_transacao: a.valor_transacao,
        codigo_autorizacao: a.codigo_autorizacao || null,
        forma_captura: a.forma_captura || null,
        status: a.status || null,
        raw_line: a.raw_line,
      }));
      const anaRes = await upsertChunks(
        supabaseAdmin,
        "getnet_analitico",
        analiticoRows,
        "integracao_id,rv,nsu_cv"
      );
      if (anaRes.error) throw new Error(`getnet_analitico: ${anaRes.error}`);

      // Espelha cada RV em extratos_bancarios (valor com sinal aplicado)
      let extratosInseridos = 0;
      let extratosIgnorados = 0;
      if (resumos.length > 0) {
        const extratosRows = resumos.map((r) => ({
          conta_id: contaId,
          igreja_id: integracao.igreja_id,
          filial_id: integracao.filial_id ?? null,
          data_transacao: r.data_rv,
          descricao: `Getnet RV ${r.rv}`,
          valor: r.valor_liquido,
          numero_documento: r.rv,
          tipo: r.valor_liquido < 0 ? "debito" : "credito",
          external_id: `getnet_rv:${r.rv}:${r.data_rv}`,
          origem: "getnet_sftp_txt",
          reconciliado: false,
        }));
        const exRes = await upsertChunks(
          supabaseAdmin,
          "extratos_bancarios",
          extratosRows,
          "conta_id,external_id"
        );
        if (exRes.error) throw new Error(`extratos_bancarios: ${exRes.error}`);
        extratosInseridos = exRes.inserted;
        extratosIgnorados = exRes.ignored;
      }

      const inseridos = resRes.inserted + anaRes.inserted;
      const ignorados = resRes.ignored + anaRes.ignored;

      arq.status = "processado";
      arq.totais = {
        total_recebido: total_linhas,
        total_inserido: inseridos,
        total_ignorado: ignorados,
        resumos: resumos.length,
        analiticos: analiticos.length,
        linhas_invalidas,
      };

      await supabaseAdmin
        .from("integracoes_execucoes_log")
        .update({
          status: "success",
          finalizado_em: new Date().toISOString(),
          duracao_ms: Date.now() - childStarted,
          total_recebido: total_linhas,
          total_inserido: inseridos,
          total_ignorado: ignorados,
          metadata: {
            parent_log_id: parentLogId,
            storage_path: arq.storage_path,
            layout: "extrato_eletronico_v10",
            data_referencia: dataReferencia,
            resumos: resumos.length,
            analiticos: analiticos.length,
            linhas_invalidas,
            extratos_inseridos: extratosInseridos,
            extratos_ignorados: extratosIgnorados,
          },
        })
        .eq("id", childLogId);

      totalRecebido += total_linhas;
      totalInserido += inseridos;
      totalIgnorado += ignorados;
    } catch (procErr: any) {
      arq.status = "erro_processamento";
      arq.erro = procErr?.message || String(procErr);
      await supabaseAdmin
        .from("integracoes_execucoes_log")
        .update({
          status: "error",
          finalizado_em: new Date().toISOString(),
          duracao_ms: Date.now() - childStarted,
          erro_mensagem: arq.erro,
          erro_stack:
            typeof procErr?.stack === "string" ? procErr.stack.slice(0, 4000) : null,
          metadata: {
            parent_log_id: parentLogId,
            storage_path: arq.storage_path,
            layout: "extrato_eletronico_v10",
            data_referencia: dataReferencia,
          },
        })
        .eq("id", childLogId);
    }
  }

  // ===== Finalização do log mestre =====
  const sucessos = arquivos.filter((a) => a.status === "processado").length;
  const falhas = arquivos.filter(
    (a) => a.status === "erro_download" || a.status === "erro_processamento"
  ).length;
  let statusMaster: "success" | "partial" | "error";
  if (sucessos === arquivos.length) statusMaster = "success";
  else if (sucessos === 0) statusMaster = "error";
  else statusMaster = "partial";

  await finishLog(supabaseAdmin, parentLogId, startedAt, {
    status: statusMaster,
    total_recebido: totalRecebido,
    total_inserido: totalInserido,
    total_ignorado: totalIgnorado,
    metadata: {
      layout: "extrato_eletronico_v10",
      data_referencia: dataReferencia,
      fase: "processamento",
      arquivos_encontrados: arquivos.length,
      arquivos_processados: sucessos,
      arquivos_com_erro: falhas,
      arquivos,
    },
  });

  return json(200, {
    success: statusMaster !== "error",
    status: statusMaster,
    data_referencia: dataReferencia,
    arquivos_baixados: arquivos.length,
    arquivos_processados: sucessos,
    arquivos_com_erro: falhas,
    totais: {
      total_recebido: totalRecebido,
      total_inserido: totalInserido,
      total_ignorado: totalIgnorado,
    },
    parent_log_id: parentLogId,
  });
}
