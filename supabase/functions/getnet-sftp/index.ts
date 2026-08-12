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
import { parseExtrato, resolverUsoTipo5 } from "./getnetExtratoParser.ts";
import { ingerirExtratos, type ExtratoItemInput } from "../_shared/financeiro-core.ts";

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
// Implementação completa importada de getnetExtratoParser.ts (parseExtrato)

// Mapeia um ResumoRecord (tipo 1) já parseado pro shape de getnet_resumo.
// Compartilhado entre o INSERT do fluxo normal (import_extrato/sync) e o
// backfill de valor_liquido_cobranca (C2-3, action "backfill_resumo_cobranca")
// — mesma fonte de verdade, sem duplicar a lista de campos.
function buildResumoRow(
  r: import("./getnetExtratoParser.ts").ResumoRecord & {
    linhaNum: number;
    rawLine: string;
  },
  integracao: { id: string; igreja_id: string; filial_id?: string | null },
  arquivoNome: string,
  // C2-6 (achado Codex P1): conta_id da integração NO MOMENTO da
  // importação — congelado aqui, não relido da config atual em consultas
  // futuras (getnet_credito_disponivel), senão editar "Conta destino" da
  // integração depois reatribuiria retroativamente todo o histórico já
  // importado. Opcional/`null` só pra runBackfillResumoCobranca, que
  // reusa esta função mas nunca grava conta_id (UPDATE ali só toca
  // valor_liquido_cobranca/id_baixa_cobranca_servico).
  contaId?: string | null,
) {
  return {
    integracao_id: integracao.id,
    igreja_id: integracao.igreja_id,
    filial_id: integracao.filial_id ?? null,
    conta_id: contaId ?? null,
    arquivo_nome: arquivoNome,
    codigo_produto: r.codigoProduto || null,
    forma_captura: r.formaCaptura || null,
    rv: r.rv,
    data_rv: r.dataRv,
    indicador_tipo_pagamento: r.indicadorTipoPagamento || "",
    data_pagamento_rv: r.dataPagamentoRv || null,
    chave_ur: r.chaveUr || null,
    valor_bruto: r.valorBruto,
    valor_liquido: r.sinal === "-" ? -Math.abs(r.valorLiquido) : r.valorLiquido,
    valor_tarifa: r.valorTarifa || null,
    valor_taxa_desconto: r.valorTaxaDesconto || null,
    // C2-3: capturados pelo parser desde sempre, descartados antes do INSERT
    // até aqui — manual pág. 14: o "sinal" geral só se refere a valor_liquido
    // (seq 14), não a este campo (seq 29) — grava magnitude simples.
    //
    // Condicional ao CI (achado do code-review), não `|| null` puro: o
    // campo só é preenchido pelo adquirente quando
    // indicador_tipo_pagamento=CI (manual pág. 13); fora disso os bytes vêm
    // sempre em branco e parseAmount devolve 0 igual a um "R$0,00" real de
    // aluguel de POS numa linha CI de verdade — `|| null` sem essa condição
    // apagaria um ajuste zero legítimo junto com o "não se aplica".
    valor_liquido_cobranca: r.indicadorTipoPagamento === "CI" ? r.valorLiquidoCobranca : null,
    id_baixa_cobranca_servico: r.idBaixaCobrancaServico || null,
    sinal: r.sinal || null,
    banco: r.banco || null,
    agencia: r.agencia || null,
    conta_corrente: r.contaCorrente || null,
    tipo_conta: r.tipoConta || null,
    num_parcela_rv: r.numParcelaRv || null,
    qtd_parcelas_rv: r.qtdParcelasRv || null,
    data_vencimento_original: r.dataVencimentoOriginal || null,
    moeda: r.moeda || null,
    raw_line: r.rawLine,
  };
}

// Baixa um arquivo já armazenado no bucket (por storage_path) e roda o
// parser posicional — sem tocar SFTP. Compartilhado entre
// runExtratoEletronicoV10 (fase 2, arquivo recém-baixado do SFTP) e
// runBackfillResumoCobranca (C2-3, arquivo já importado antes) — mesmo
// mecanismo que a C2-5 (shadow mode) também vai reaproveitar (achado do
// code-review: evita duplicar decode+parse numa terceira cópia).
async function baixarEParsearDoBucket(
  supabaseAdmin: any,
  storagePath: string,
): Promise<ReturnType<typeof parseExtrato>> {
  const { data: blob, error: dlErr } = await supabaseAdmin.storage
    .from(RAW_BUCKET)
    .download(storagePath);
  if (dlErr || !blob) throw new Error(dlErr?.message || "Falha ao baixar do bucket");
  const buf = new Uint8Array(await blob.arrayBuffer());
  const text = new TextDecoder("latin1").decode(buf);
  return parseExtrato(text);
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
  action:
    | "test_connection"
    | "list_files"
    | "import_extrato"
    | "sync"
    | "backfill_resumo_cobranca";
  integracao_id: string;
  arquivo_nome?: string;
  data_referencia?: string; // YYYY-MM-DD (override do "hoje")
  batch_size?: number;      // sync: máx de arquivos por execução (default 7)
  data_referencia_inicio?: string; // backfill_resumo_cobranca: início do range (YYYY-MM-DD)
  data_referencia_fim?: string;    // backfill_resumo_cobranca: fim do range (YYYY-MM-DD)
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

    // Service-role bypass: cron jobs authenticate with the service_role key directly
    let userId: string;
    if (token === serviceKey) {
      userId = "cron";
    } else {
      const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsError } =
        await supabaseUser.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        return json(401, { error: "Unauthorized" });
      }
      userId = claimsData.claims.sub;
    }

    const payload = (await req.json().catch(() => null)) as Payload | null;
    if (!payload || !payload.integracao_id || !payload.action) {
      return json(400, { error: "Invalid payload" });
    }
    if (
      ![
        "test_connection",
        "list_files",
        "import_extrato",
        "sync",
        "backfill_resumo_cobranca",
      ].includes(payload.action)
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

    if (userId !== "cron") {
      const hasPermission = await validatePermissions(
        supabaseAdmin,
        userId,
        integracao.igreja_id
      );
      if (!hasPermission) return json(403, { error: "Insufficient permissions" });
    }

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
      created_by: userId === "cron" ? null : userId,
    };

    // ===== backfill_resumo_cobranca (C2-3) =====
    // Lê arquivos JÁ IMPORTADOS direto do bucket (sem SFTP live) e faz
    // UPDATE só de valor_liquido_cobranca/id_baixa_cobranca_servico em
    // getnet_resumo — não toca nenhuma outra tabela, não duplica linha.
    if (payload.action === "backfill_resumo_cobranca") {
      return await runBackfillResumoCobranca({
        supabaseAdmin,
        baseLogCtx,
        startedAt,
        integracao,
        arquivoNome: payload.arquivo_nome ?? null,
        dataInicio: payload.data_referencia_inicio ?? payload.data_referencia ?? null,
        dataFim: payload.data_referencia_fim ?? payload.data_referencia ?? null,
        // Mesmo teto de runSyncExtratoV10 (batchSize, linha ~651) — um
        // range grande processado inteiro numa chamada só arrisca estourar
        // o timeout da Edge Function (achado do code-review). Chamador
        // reinvoca pra continuar; arquivos_restantes no retorno indica quanto falta.
        // Piso de 1 (achado do code-review): batch_size=0 zerava
        // arquivosAlvo, o loop nunca rodava e o status ainda saía "success"
        // (arquivosComErro fica 0 por vacuidade) — resposta enganosa de
        // "concluído" com trabalho pendente real. `payload.batch_size` não
        // é validado em runtime (só tipado `number`) — um valor não
        // numérico viraria NaN e `.limit(NaN)` na query (achado do
        // code-review); `Number.isFinite` cai pro default 7 nesse caso.
        // `Math.trunc` (achado Codex P2): um valor finito fracionário
        // (ex.: 1.5) passava direto pro `.limit(batchSize)` — PostgREST
        // exige limit inteiro, então um request válido virava erro de
        // banco em vez de arredondar/truncar.
        batchSize: Math.max(
          1,
          Math.min(
            Number.isFinite(payload.batch_size) ? Math.trunc(payload.batch_size as number) : 7,
            30,
          ),
        ),
      });
    }

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

    // ===== sync =====
    if (payload.action === "sync") {
      if (!contaId) {
        logId = await startLog(supabaseAdmin, { ...baseLogCtx, acao: "sync" });
        await finishLog(supabaseAdmin, logId, startedAt, {
          status: "error",
          erro_mensagem: "config.sftp.conta_id não configurado",
        });
        return json(200, { success: false, error: "Conta bancária não configurada." });
      }
      if (layout !== "extrato_eletronico_v10") {
        return json(200, { success: false, error: `Sync não suportado para layout: ${layout}` });
      }
      return await runSyncExtratoV10({
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
        // Mesma classe de bug corrigida em runBackfillResumoCobranca
        // (achado do code-review, sinalizado aqui como inconsistência já
        // que a correção nova ficou a poucas linhas desta): sem piso e sem
        // `Number.isFinite`, `batch_size:0` zerava `missing.slice(0,0)` e o
        // sync ainda reportava "success" sem processar nada; um valor não
        // numérico virava NaN. `Math.trunc` (achado Codex P2 na
        // backfill_resumo_cobranca, aplicado aqui por consistência): este
        // batchSize só alimenta `.slice()` (JS trunca sozinho), mas manter
        // os dois call sites idênticos evita o mesmo bug reaparecer se
        // algum dia este valor passar a alimentar uma query `.limit()`.
        batchSize: Math.max(
          1,
          Math.min(
            Number.isFinite(payload.batch_size) ? Math.trunc(payload.batch_size as number) : 7,
            30,
          ),
        ),
      });
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
      const itens: ExtratoItemInput[] = parsed.map((p) => ({
        data_transacao: p.data_transacao,
        valor: p.valor,
        tipo: p.tipo,
        descricao: p.descricao,
        numero_documento: p.numero_documento,
        external_id: p.external_id,
      }));
      try {
        // Porta única de ingestão (F5): canal 'integracao' sem ator humano
        // (D-F5.2) — condizente com o client service-role usado em toda a function.
        const res = await ingerirExtratos(supabaseAdmin, contaId, "getnet_sftp", itens, {
          igreja_id: integracao.igreja_id,
          filial_id: integracao.filial_id ?? null,
          canal: "integracao",
        });
        inserted = Number(res.inseridos ?? 0);
        ignored = Number(res.duplicados ?? 0);
      } catch (upErr) {
        const message = upErr instanceof Error ? upErr.message : String(upErr);
        await finishLog(supabaseAdmin, logId, startedAt, {
          status: "error",
          arquivo_nome: target.name,
          erro_mensagem: `Erro ao inserir extratos: ${message}`,
        });
        return json(200, { success: false, error: message });
      }
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

  // F6/D5 (C2-8: não alimenta mais espelho em extratos_bancarios, só a
  // fonte de getnet_credito_disponivel_view, C2-6): tipo 5 (PG, dinheiro
  // real) em vez do tipo 1 (LQ) para arquivos com data_referencia >= corte
  // configurado por integração. Opt-in: sem `espelho_tipo5_desde`, mantém o
  // comportamento legado (tipo 1). Fica no nível raiz de `config` (não em
  // `config.sftp`) para sobreviver ao merge raso da edge integracoes-config.
  const cfgIntegracao = (integracao.config ?? {}) as Record<string, unknown>;
  const espelhoTipo5Desde =
    typeof cfgIntegracao.espelho_tipo5_desde === "string" && cfgIntegracao.espelho_tipo5_desde
      ? cfgIntegracao.espelho_tipo5_desde
      : null;
  const usarTipo5 = espelhoTipo5Desde !== null && dataReferencia >= espelhoTipo5Desde;

  // regex default: getnetextr_YYYYMMDD_XXXXXXXX_c101.txt
  const defaultRegex = "^getnetextr_(\\d{4})(\\d{2})(\\d{2})_.+\\.txt$";
  const regexStr = filePatternRegex || defaultRegex;
  const fileRegex = new RegExp(regexStr, "i");

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
      // Se a regex captura 3 grupos (YYYY, MM, DD), filtra por data alvo
      if (m.length >= 4) {
        const fileDate = `${m[1]}-${m[2]}-${m[3]}`; // YYYY-MM-DD
        return fileDate === dataReferencia;
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
      const parsed = await baixarEParsearDoBucket(supabaseAdmin, arq.storage_path);
      const { resumos, analiticos, ajustes, financeirosResumo, financeirosDetalhe, validacao } = parsed;

      // ── getnet_resumo (tipo 1) — chave inclui indicador para ciclo PF→LQ ─
      const resumoRows = resumos.map((r) => buildResumoRow(r, integracao, arq.nome, contaId));
      const resRes = await upsertChunks(
        supabaseAdmin, "getnet_resumo", resumoRows,
        "integracao_id,rv,data_rv,indicador_tipo_pagamento"
      );
      if (resRes.error) throw new Error(`getnet_resumo: ${resRes.error}`);

      // ── getnet_analitico (tipo 2) ───────────────────────────────────────
      const analiticoRows = analiticos.map((a) => ({
        integracao_id: integracao.id,
        igreja_id: integracao.igreja_id,
        filial_id: integracao.filial_id ?? null,
        arquivo_nome: arq.nome,
        rv: a.rv,
        nsu_cv: a.nsuCv,
        cartao_truncado: a.cartaoTruncado || null,
        valor_transacao: a.valorTransacao,
        codigo_autorizacao: a.codigoAutorizacao || null,
        forma_captura: a.formaCaptura || null,
        status: a.status || null,
        data_transacao: a.dataTransacao || null,
        hora_transacao: a.horaTransacao || null,
        codigo_terminal: a.codigoTerminal || null,
        valor_comissao: a.valorComissao || null,
        numero_parcelas: a.numeroParcelas || null,
        parcela_do_cv: a.parcelaDoCv || null,
        valor_parcela: a.valorParcela || null,
        moeda: a.moeda || null,
        sinal: a.sinal || null,
        raw_line: a.rawLine,
      }));
      const anaRes = await upsertChunks(
        supabaseAdmin, "getnet_analitico", analiticoRows,
        "integracao_id,rv,nsu_cv"
      );
      if (anaRes.error) throw new Error(`getnet_analitico: ${anaRes.error}`);

      // ── getnet_ajustes (tipo 3) ─────────────────────────────────────────
      let ajusteRes = { inserted: 0, ignored: 0, error: null as string | null };
      if (ajustes.length > 0) {
        const ajusteRows = ajustes.map((a) => ({
          integracao_id: integracao.id,
          igreja_id: integracao.igreja_id,
          arquivo_nome: arq.nome,
          linha_num: a.linhaNum,
          rv_ajustado: a.rvAjustado,
          data_rv: a.dataRv || null,
          data_pagamento_rv: a.dataPagamentoRv || null,
          identificador_ajuste: a.identificadorAjuste || "",
          sinal: a.sinal || null,
          valor_ajuste: a.valorAjuste || null,
          motivo_ajuste: a.motivoAjuste || null,
          data_carta: a.dataCarta || null,
          cartao_truncado: a.cartaoTruncado || null,
          rv_original: a.rvOriginal || null,
          nsu_cv: a.nsuCv || null,
          data_transacao_original: a.dataTransacaoOriginal || null,
          indicador_tipo_pagamento: a.indicadorTipoPagamento || null,
          numero_terminal: a.numeroTerminal || null,
          data_pagamento_original: a.dataPagamentoOriginal || null,
          moeda: a.moeda || null,
          valor_comissao: a.valorComissao || null,
          raw_line: a.rawLine,
        }));
        ajusteRes = await upsertChunks(
          supabaseAdmin, "getnet_ajustes", ajusteRows,
          "integracao_id,rv_ajustado,identificador_ajuste"
        );
        if (ajusteRes.error) throw new Error(`getnet_ajustes: ${ajusteRes.error}`);
      }

      // ── getnet_financeiro_resumo (tipo 5) ───────────────────────────────
      let finResRes = { inserted: 0, ignored: 0, error: null as string | null };
      if (financeirosResumo.length > 0) {
        const finResRows = financeirosResumo.map((f) => ({
          integracao_id: integracao.id,
          igreja_id: integracao.igreja_id,
          // C2-6 (achado Codex P1): mesma lógica de buildResumoRow — conta_id
          // congelado no momento da importação, não relido depois.
          conta_id: contaId,
          arquivo_nome: arq.nome,
          linha_num: f.linhaNum,
          numero_operacao: f.numeroOperacao,
          chave_ur: f.chaveUr || null,
          data_operacao: f.dataOperacao || null,
          data_credito_operacao: f.dataCreditoOperacao || null,
          tipo_operacao: f.tipoOperacao || null,
          valor_bruto_operacao: f.valorBrutoOperacao,
          valor_custo_operacao: f.valorCustoOperacao,
          valor_liquido_operacao: f.valorLiquidoOperacao,
          taxa_mensal_operacao: f.taxaMensalOperacao || null,
          tipo_conta_estabelecimento: f.tipoContaEstabelecimento || null,
          banco: f.banco || null,
          agencia: f.agencia || null,
          conta_corrente: f.contaCorrente || null,
          canal_operacao: f.canalOperacao || null,
          tipo_movimento: f.tipoMovimento || null,
          participante_cnpj_cpf: f.participanteCnpjCpf || null,
          participante_banco: f.participanteBanco || null,
          participante_agencia: f.participanteAgencia || null,
          participante_conta_corrente: f.participanteContaCorrente || null,
          participante_razao_social: f.participanteRazaoSocial || null,
          codigo_arranjo: f.codigoArranjo || null,
          raw_line: f.rawLine,
        }));
        finResRes = await upsertChunks(
          supabaseAdmin, "getnet_financeiro_resumo", finResRows,
          "integracao_id,numero_operacao"
        );
        if (finResRes.error) throw new Error(`getnet_financeiro_resumo: ${finResRes.error}`);
      }

      // ── getnet_financeiro_detalhe (tipo 6) ──────────────────────────────
      let finDetRes = { inserted: 0, ignored: 0, error: null as string | null };
      if (financeirosDetalhe.length > 0) {
        const finDetRows = financeirosDetalhe.map((f) => ({
          integracao_id: integracao.id,
          igreja_id: integracao.igreja_id,
          arquivo_nome: arq.nome,
          linha_num: f.linhaNum,
          numero_operacao: f.numeroOperacao,
          chave_ur: f.chaveUr,
          data_operacao: f.dataOperacao || null,
          tipo_operacao: f.tipoOperacao || null,
          codigo_produto: f.codigoProduto || null,
          data_vencimento_ur: f.dataVencimentoUr || null,
          valor_liquido_ur: f.valorLiquidoUr,
          valor_custo_ur: f.valorCustoUr,
          valor_bruto_ur: f.valorBrutoUr,
          tipo_conta_estabelecimento: f.tipoContaEstabelecimento || null,
          tipo_movimento: f.tipoMovimento || null,
          participante_cnpj_cpf: f.participanteCnpjCpf || null,
          participante_razao_social: f.participanteRazaoSocial || null,
          raw_line: f.rawLine,
        }));
        finDetRes = await upsertChunks(
          supabaseAdmin, "getnet_financeiro_detalhe", finDetRows,
          "integracao_id,numero_operacao,chave_ur"
        );
        if (finDetRes.error) throw new Error(`getnet_financeiro_detalhe: ${finDetRes.error}`);
      }

      // ── espelho_origem (getnet_arquivos) ────────────────────────────────
      // C2-8: parou de espelhar em extratos_bancarios — nada mais casa
      // contra o espelho (C2-7/motor F4 já rejeitam essas 3 origens) e
      // nenhum saldo de conta depende dele (extratos_bancarios não tem
      // trigger de saldo). `espelho_origem` continua sendo travado por
      // arquivo (mesma lógica de sempre, P1 review PR #52 — a origem
      // escolhida na 1a importação não pode trocar depois que
      // `espelho_tipo5_desde` muda retroativamente) porque
      // `getnet_credito_disponivel_view.sql` (C2-6) ainda usa esta coluna
      // pra decidir entre tipo1/LQ e tipo5/PG por arquivo.
      const { data: arquivoJaProcessado } = await supabaseAdmin
        .from("getnet_arquivos")
        .select("espelho_origem")
        .eq("integracao_id", integracao.id)
        .eq("arquivo_nome", arq.nome)
        .maybeSingle();
      const usarTipo5ParaEsteArquivo = resolverUsoTipo5(arquivoJaProcessado, usarTipo5);

      // ── getnet_arquivos (controle por arquivo) — written only after all upserts succeed
      // so failed imports are not silently skipped on the next sync run.
      await supabaseAdmin
        .from("getnet_arquivos")
        .upsert({
          integracao_id: integracao.id,
          igreja_id: integracao.igreja_id,
          arquivo_nome: arq.nome,
          data_referencia: dataReferencia,
          storage_path: arq.storage_path,
          sequencia_remessa: parsed.header?.sequenciaRemessa ?? null,
          qtd_registros_declarada: validacao.qtdRegistrosDeclarada,
          qtd_registros_lida: validacao.qtdRegistrosLidos,
          validacao_ok: validacao.ok,
          erros_validacao: validacao.erros.length > 0 ? validacao.erros : null,
          codigo_estabelecimento: parsed.header?.codigoEstabelecimento ?? null,
          cnpj_adquirente: parsed.header?.cnpjAdquirente ?? null,
          espelho_origem: usarTipo5ParaEsteArquivo ? "getnet_sftp_tipo5" : "getnet_sftp_txt",
          // buildResumoRow (usado no resumoRows.map acima) já grava
          // valor_liquido_cobranca/id_baixa_cobranca_servico no INSERT desde
          // C2-3 — arquivo importado do zero a partir daqui nunca precisa do
          // backfill_resumo_cobranca. MAS `resRes.ignored > 0` (achado do
          // code-review) significa que pelo menos 1 linha já existia em
          // getnet_resumo e o upsert (ON CONFLICT DO NOTHING, `upsertChunks`
          // linha ~395) NÃO tocou nela — cenário real: reimportar pelo botão
          // manual (GetnetListFilesDialog) um arquivo importado ANTES da
          // C2-3 existir. Omitir o campo aqui (em vez de sempre carimbar)
          // deixa o upsert por conflito não sobrescrever o valor já
          // guardado — arquivo com linha órfã continua elegível pro
          // backfill_resumo_cobranca de verdade, em vez de se esconder pra
          // sempre atrás de um carimbo que mentia sobre o dado já estar
          // completo.
          ...(resRes.ignored === 0
            ? { resumo_cobranca_backfilled_at: new Date().toISOString() }
            : {}),
        }, { onConflict: "integracao_id,arquivo_nome" });

      const totalLinhas = validacao.qtdRegistrosLidos;
      const inseridos = resRes.inserted + anaRes.inserted + ajusteRes.inserted +
        finResRes.inserted + finDetRes.inserted;
      const ignorados = resRes.ignored + anaRes.ignored + ajusteRes.ignored +
        finResRes.ignored + finDetRes.ignored;

      arq.status = "processado";
      arq.totais = {
        total_recebido: totalLinhas,
        total_inserido: inseridos,
        total_ignorado: ignorados,
        resumos: resumos.length,
        analiticos: analiticos.length,
        linhas_invalidas: parsed.desconhecidos.length,
      };

      await supabaseAdmin
        .from("integracoes_execucoes_log")
        .update({
          status: "success",
          finalizado_em: new Date().toISOString(),
          duracao_ms: Date.now() - childStarted,
          total_recebido: totalLinhas,
          total_inserido: inseridos,
          total_ignorado: ignorados,
          metadata: {
            parent_log_id: parentLogId,
            storage_path: arq.storage_path,
            layout: "extrato_eletronico_v10",
            data_referencia: dataReferencia,
            resumos: resumos.length,
            analiticos: analiticos.length,
            ajustes: ajustes.length,
            financeiros_resumo: financeirosResumo.length,
            financeiros_detalhe: financeirosDetalhe.length,
            validacao_ok: validacao.ok,
            erros_validacao: validacao.erros,
          },
        })
        .eq("id", childLogId);

      totalRecebido += totalLinhas;
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

// ==================== runner: backfill_resumo_cobranca (C2-3) ====================
// Reprocessa arquivo(s) JÁ IMPORTADOS lendo direto do bucket
// (getnet-raw-files, storage_path já registrado em getnet_arquivos) — sem
// SFTP live, sem exigir que o arquivo ainda exista no servidor remoto.
// Escopo estreito de propósito: só UPDATE de valor_liquido_cobranca/
// id_baixa_cobranca_servico em getnet_resumo, por linha já existente
// (chave natural integracao_id+rv+data_rv+indicador_tipo_pagamento) — não
// insere, não duplica, não toca extratos_bancarios/getnet_arquivos nem as
// outras 5 tabelas. O par download-do-bucket+parseExtrato é o mesmo
// mecanismo que a C2-5 (shadow mode dos campos novos de tipo5/6) vai
// reaproveitar — por isso fica em runner próprio, não emaranhado no fluxo
// de import_extrato.
//
// Limitação conhecida, documentada (não débito escondido): um arquivo que
// falha SEMPRE (ex.: objeto removido/expirado no bucket, storage_path
// legado nulo) nunca é marcado `resumo_cobranca_backfilled_at` e volta a
// ser selecionado (oldest-first) em toda chamada futura sobre o mesmo
// escopo — não há contador de tentativas nem "pular arquivo com problema".
// Consome 1 de até `batchSize` vagas por chamada, não trava as demais; o
// `erro` de cada arquivo aparece em `detalhes[]` a cada chamada, então o
// problema é visível pro operador, que resolve isolando esse arquivo via
// `arquivo_nome` explícito. Mesmo modelo de "sem retry automático além do
// reinvoke manual" que `runSyncExtratoV10` já tem pra arquivo com erro.
async function runBackfillResumoCobranca(args: {
  supabaseAdmin: any;
  baseLogCtx: {
    integracao_id: string;
    igreja_id: string;
    filial_id: string | null;
    provedor: string;
    created_by: string | null;
  };
  startedAt: number;
  integracao: { id: string; igreja_id: string; filial_id: string | null };
  arquivoNome: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  batchSize: number;
}): Promise<Response> {
  const { supabaseAdmin, baseLogCtx, startedAt, integracao, arquivoNome, dataInicio, dataFim, batchSize } = args;

  if (!arquivoNome && !dataInicio && !dataFim) {
    return json(400, {
      success: false,
      error: "Informe arquivo_nome ou data_referencia_inicio/data_referencia_fim — reprocesso sem escopo não é permitido.",
    });
  }

  const logId = await startLog(supabaseAdmin, {
    ...baseLogCtx,
    acao: "backfill_resumo_cobranca",
    metadata: { arquivo_nome: arquivoNome, data_inicio: dataInicio, data_fim: dataFim },
  });

  // 1. Localiza os arquivos já importados que casam o escopo pedido — exclui
  // quem já foi backfillado com sucesso (achado do code-review: sem esse
  // filtro, reinvocar com o mesmo payload reprocessava sempre os mesmos
  // `batchSize` primeiros arquivos e `arquivos_restantes` nunca chegava a 0).
  //
  // `count: "exact"` + `.limit(batchSize)` direto na query (em vez de
  // buscar tudo e fatiar em memória) — achado do code-review: sem isso, o
  // cap default de linhas do PostgREST (1000) truncaria silenciosamente
  // `todosArquivos` num backlog grande, e `arquivos_restantes` (total -
  // processados) saía menor que o real. `count` reflete o total que casa o
  // filtro independente do `.limit()` aplicado à página retornada.
  //
  // `.is("resumo_cobranca_backfilled_at", null)` vale mesmo quando o
  // chamador informa `arquivo_nome` explícito — decisão consciente, não
  // esquecimento: não existe flag pra forçar reprocesso de um arquivo já
  // marcado completo. Se um bug futuro no gate CI/offset de bytes exigir
  // reabrir um arquivo específico, o remédio é `UPDATE getnet_arquivos SET
  // resumo_cobranca_backfilled_at = NULL WHERE arquivo_nome = '...'` direto
  // (ação admin-only, já tem acesso de banco) — evita um parâmetro novo na
  // Payload só pra um cenário de recuperação raro.
  // `.not("storage_path", "is", null)` (achado do code-review): arquivo
  // legado sem storage_path (coluna nullable desde 20260617000001) NUNCA
  // vai conseguir ser baixado do bucket — não é falha transitória pra
  // tentar de novo, é impossibilidade estrutural. Sem excluir daqui, esse
  // arquivo ficaria pra sempre na frente da fila (oldest-first), comendo 1
  // de até `batchSize` vagas em toda chamada futura e travando o avanço
  // dos arquivos saudáveis atrás dele. Contado à parte (`arquivos_sem_
  // storage_path` abaixo) pra não desaparecer silenciosamente da resposta.
  let query = supabaseAdmin
    .from("getnet_arquivos")
    .select("arquivo_nome, storage_path, data_referencia", { count: "exact" })
    .eq("integracao_id", integracao.id)
    .is("resumo_cobranca_backfilled_at", null)
    .not("storage_path", "is", null);
  if (arquivoNome) query = query.eq("arquivo_nome", arquivoNome);
  if (dataInicio) query = query.gte("data_referencia", dataInicio);
  if (dataFim) query = query.lte("data_referencia", dataFim);

  let semStoragePathQuery = supabaseAdmin
    .from("getnet_arquivos")
    .select("id", { count: "exact", head: true })
    .eq("integracao_id", integracao.id)
    .is("resumo_cobranca_backfilled_at", null)
    .is("storage_path", null);
  if (arquivoNome) semStoragePathQuery = semStoragePathQuery.eq("arquivo_nome", arquivoNome);
  if (dataInicio) semStoragePathQuery = semStoragePathQuery.gte("data_referencia", dataInicio);
  if (dataFim) semStoragePathQuery = semStoragePathQuery.lte("data_referencia", dataFim);
  const { count: arquivosSemStoragePath } = await semStoragePathQuery;

  // Teto por chamada (mesmo padrão de runSyncExtratoV10) — evita estourar o
  // timeout da Edge Function num range grande; oldest-first, chamador
  // reinvoca (mesmo payload) até arquivos_restantes chegar a 0.
  const { data: arquivosAlvo, error: listErr, count: totalPendente } = await query
    .order("data_referencia", { ascending: true })
    .limit(batchSize);
  if (listErr) {
    await finishLog(supabaseAdmin, logId, startedAt, { status: "error", erro_mensagem: listErr.message });
    return json(200, { success: false, error: listErr.message });
  }
  if (!arquivosAlvo || arquivosAlvo.length === 0) {
    // Distingue "escopo nunca existiu" (erro real) de "escopo existe mas já
    // está 100% backfillado" (achado do code-review: sem essa distinção, um
    // chamador que reinvoca até `arquivos_restantes=0` recebia
    // `success:false`/status "error" bem na chamada que confirma
    // conclusão — falso positivo pra qualquer alerta em cima do status).
    let scopeQuery = supabaseAdmin
      .from("getnet_arquivos")
      .select("id", { count: "exact", head: true })
      .eq("integracao_id", integracao.id);
    if (arquivoNome) scopeQuery = scopeQuery.eq("arquivo_nome", arquivoNome);
    if (dataInicio) scopeQuery = scopeQuery.gte("data_referencia", dataInicio);
    if (dataFim) scopeQuery = scopeQuery.lte("data_referencia", dataFim);
    const { count: totalNoEscopo } = await scopeQuery;

    if (totalNoEscopo && totalNoEscopo > 0) {
      await finishLog(supabaseAdmin, logId, startedAt, {
        status: "success",
        total_recebido: 0,
        metadata: { detalhes: [], arquivos_restantes: 0, arquivos_sem_storage_path: arquivosSemStoragePath ?? 0 },
      });
      return json(200, {
        success: true,
        arquivos_encontrados: 0,
        arquivos_restantes: 0,
        // Achado do code-review: com o filtro `.not("storage_path", "is",
        // null)` acima, chegar aqui com arquivos_sem_storage_path > 0
        // significa "processável zerou, mas sobraram arquivos que este
        // mecanismo nunca vai conseguir resolver" — não confundir com
        // backfill 100% completo de verdade.
        arquivos_sem_storage_path: arquivosSemStoragePath ?? 0,
        arquivos_processados: 0,
        arquivos_com_erro: 0,
        linhas_atualizadas: 0,
        linhas_puladas: 0,
        linhas_nao_encontradas: 0,
        detalhes: [],
      });
    }

    await finishLog(supabaseAdmin, logId, startedAt, {
      status: "error",
      erro_mensagem: "Nenhum arquivo já importado casa o escopo informado.",
    });
    return json(200, { success: false, error: "Nenhum arquivo encontrado para o escopo informado." });
  }

  let arquivosProcessados = 0;
  let arquivosComErro = 0;
  let arquivosBackfilled = 0;
  let linhasAtualizadas = 0;
  let linhasPuladas = 0;
  let linhasNaoEncontradas = 0;
  const detalhes: Array<{
    arquivo_nome: string;
    status: string;
    erro?: string;
    atualizadas?: number;
    puladas?: number;
  }> = [];

  // Atualiza 1 linha (chamada isolada — achado do code-review: o try/catch
  // original envolvia o arquivo INTEIRO, então uma linha com erro descartava
  // a contagem de tudo que já tinha sido atualizado com sucesso antes dela
  // no mesmo arquivo, e abortava as linhas restantes sem tentar).
  async function atualizarLinha(
    r: Parameters<typeof buildResumoRow>[0],
    arquivoNomeAtual: string,
  ): Promise<
    | { ok: true; outcome: "atualizada" | "pulada" | "nao_encontrada" }
    | { ok: false; erro: string }
  > {
    // arquivo_nome ENTRA no WHERE (achado do code-review): a constraint de
    // unicidade de getnet_resumo é só integracao_id+rv+data_rv+
    // indicador_tipo_pagamento (não inclui arquivo_nome) — se a Getnet
    // reenviar o mesmo RV/data sob um arquivo_nome diferente, a linha
    // salva em getnet_resumo pertence a QUALQUER QUE SEJA o arquivo que
    // ganhou a corrida do upsert original (`ON CONFLICT DO NOTHING`), não
    // necessariamente o arquivo sendo reprocessado agora. Sem esse filtro,
    // um backfill do arquivo "perdedor" gravaria o valor de cobrança dele
    // por cima de uma linha que fisicamente veio de outro arquivo.
    //
    // 0 rows com arquivo_nome NÃO é automaticamente "não encontrada"
    // (achado Codex P1 / review): a chave natural pode já pertencer a
    // OUTRO arquivo. Tratar isso como permanente-pending nunca carimbava
    // o perdedor, reselecionava oldest-first pra sempre e podia esgotar
    // o batchSize faminto o resto do histórico. Distingue:
    //   - atualizada: UPDATE bateu (linha deste arquivo)
    //   - pulada: chave natural existe sob outro arquivo_nome → resolvida
    //     (não sobrescreve; conta pra `completo`)
    //   - nao_encontrada: chave natural ausente de verdade (import
    //     incompleto) → NÃO carimba
    const row = buildResumoRow(r, integracao, arquivoNomeAtual);
    try {
      const { data: updated, error: updErr } = await supabaseAdmin
        .from("getnet_resumo")
        .update({
          valor_liquido_cobranca: row.valor_liquido_cobranca,
          id_baixa_cobranca_servico: row.id_baixa_cobranca_servico,
        })
        .eq("integracao_id", row.integracao_id)
        .eq("rv", row.rv)
        .eq("data_rv", row.data_rv)
        .eq("indicador_tipo_pagamento", row.indicador_tipo_pagamento)
        .eq("arquivo_nome", row.arquivo_nome)
        .select("id");
      if (updErr) return { ok: false, erro: updErr.message };
      if (updated && updated.length > 0) {
        return { ok: true, outcome: "atualizada" };
      }

      const { data: existente, error: selErr } = await supabaseAdmin
        .from("getnet_resumo")
        .select("id, arquivo_nome")
        .eq("integracao_id", row.integracao_id)
        .eq("rv", row.rv)
        .eq("data_rv", row.data_rv)
        .eq("indicador_tipo_pagamento", row.indicador_tipo_pagamento)
        .maybeSingle();
      if (selErr) return { ok: false, erro: selErr.message };
      if (existente && existente.arquivo_nome !== row.arquivo_nome) {
        return { ok: true, outcome: "pulada" };
      }
      return { ok: true, outcome: "nao_encontrada" };
    } catch (err) {
      return { ok: false, erro: err instanceof Error ? err.message : String(err) };
    }
  }

  // Concorrência limitada por chunk (não sequencial 1 a 1, não Promise.all
  // do arquivo inteiro de uma vez) — reduz wall-clock num arquivo com
  // centenas de linhas sem abrir mão de isolamento de erro por linha
  // (achado do code-review sobre risco de timeout da Edge Function).
  const CHUNK_CONCORRENCIA = 20;
  async function atualizarLinhasEmChunks(
    resumos: Array<Parameters<typeof buildResumoRow>[0]>,
    arquivoNomeAtual: string,
  ): Promise<{
    atualizadas: number;
    puladas: number;
    naoEncontradas: number;
    erros: string[];
  }> {
    // Dedupe pela chave natural (integracao_id+rv+data_rv+
    // indicador_tipo_pagamento) antes de disparar chunks concorrentes —
    // achado do code-review: duas linhas do MESMO arquivo com essa chave
    // igual (num_parcela_rv não entra na chave) gerariam 2 UPDATEs
    // concorrentes na mesma linha física, resultado não-determinístico por
    // corrida. Mantém a PRIMEIRA ocorrência — mesmo critério do INSERT
    // original (`upsertChunks` usa `ignoreDuplicates: true`, que descarta
    // silenciosamente as ocorrências seguintes no conflito), pra não gravar
    // um valor de cobrança que não corresponde à linha que ficou salva.
    const porChave = new Map<string, Parameters<typeof buildResumoRow>[0]>();
    for (const r of resumos) {
      const chave = `${r.rv}|${r.dataRv}|${r.indicadorTipoPagamento}`;
      if (!porChave.has(chave)) porChave.set(chave, r);
    }
    const resumosSemDuplicata = Array.from(porChave.values());

    let atualizadas = 0;
    let puladas = 0;
    let naoEncontradas = 0;
    const erros: string[] = [];
    for (let i = 0; i < resumosSemDuplicata.length; i += CHUNK_CONCORRENCIA) {
      const chunk = resumosSemDuplicata.slice(i, i + CHUNK_CONCORRENCIA);
      const resultados = await Promise.all(chunk.map((r) => atualizarLinha(r, arquivoNomeAtual)));
      for (const res of resultados) {
        if (!res.ok) erros.push(res.erro);
        else if (res.outcome === "atualizada") atualizadas++;
        else if (res.outcome === "pulada") puladas++;
        else naoEncontradas++;
      }
    }
    return { atualizadas, puladas, naoEncontradas, erros };
  }

  for (const arq of arquivosAlvo) {
    try {
      const { resumos } = await baixarEParsearDoBucket(supabaseAdmin, arq.storage_path);

      const resultado = await atualizarLinhasEmChunks(resumos, arq.arquivo_nome);
      linhasAtualizadas += resultado.atualizadas;
      linhasPuladas += resultado.puladas;
      linhasNaoEncontradas += resultado.naoEncontradas;
      arquivosProcessados++;

      // Só marca backfilled quando TODA linha do arquivo foi resolvida sem
      // erro E sem lacuna real em getnet_resumo (achado do code-review):
      // "não encontrada" pode ser sintoma de um import original incompleto
      // (upsertChunks retorna cedo se um chunk falha — ver linha ~397), não
      // "nada a fazer aqui". Linhas `puladas` (chave natural já pertencente
      // a outro arquivo) contam como resolvidas — não bloqueiam o carimbo.
      // Marcar como concluído com naoEncontradas>0 esconderia o gap pra
      // sempre, já que o filtro `.is("resumo_cobranca_backfilled_at", null)`
      // nunca mais revisitaria o arquivo.
      const linhasOk = resultado.erros.length === 0 && resultado.naoEncontradas === 0;
      let completo = false;
      let stampErro: string | null = null;
      if (linhasOk) {
        // Achado Codex P2 / review: checar o update do marcador ANTES de
        // contar sucesso. Ignorar `{ error }` reportava success /
        // arquivos_restantes diminuído mesmo com o marcador ainda NULL —
        // a próxima chamada reprocessava o arquivo inteiro.
        const { error: stampErr } = await supabaseAdmin
          .from("getnet_arquivos")
          .update({ resumo_cobranca_backfilled_at: new Date().toISOString() })
          .eq("integracao_id", integracao.id)
          .eq("arquivo_nome", arq.arquivo_nome);
        if (stampErr) {
          stampErro = stampErr.message;
        } else {
          completo = true;
          arquivosBackfilled++;
        }
      }

      const falhasLinha = resultado.erros.length > 0;
      detalhes.push({
        arquivo_nome: arq.arquivo_nome,
        status: completo
          ? "ok"
          : stampErro
            ? "parcial"
            : falhasLinha
              ? "parcial"
              : "linhas_nao_encontradas",
        atualizadas: resultado.atualizadas,
        puladas: resultado.puladas,
        ...(stampErro
          ? { erro: `marcador resumo_cobranca_backfilled_at: ${stampErro}` }
          : falhasLinha
            ? { erro: `${resultado.erros.length} linha(s) falharam: ${resultado.erros[0]}` }
            : {}),
      });
      if (falhasLinha || stampErro) arquivosComErro++;
    } catch (err) {
      arquivosComErro++;
      detalhes.push({
        arquivo_nome: arq.arquivo_nome,
        status: "erro",
        erro: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Recalculado com o resultado real do processamento deste batch (achado
  // do code-review): `totalPendente - arquivosAlvo.length`, antes do loop,
  // não refletia falhas ocorridas dentro do próprio batch — um arquivo com
  // erro no meio da execução ficava fora da contagem de "restantes" nesta
  // resposta (a próxima chamada corrige sozinha, mas a resposta desta
  // ficava otimista demais pra quem só olha 1 chamada). `totalPendente` vem
  // do `count: "exact"` da query — reflete o total real, não a página
  // truncada pelo `.limit(batchSize)`.
  const arquivosRestantes = (totalPendente ?? arquivosAlvo.length) - arquivosBackfilled;

  // Não basta `arquivosComErro === 0` pra "success" (achado do code-review):
  // um arquivo com `naoEncontradas > 0` mas sem erro de linha (ex.: chave
  // natural nunca casa por alguma mudança futura no parser/gate CI) nunca
  // conta pra `arquivosComErro`, então um batch inteiro sem progresso real
  // (`arquivosBackfilled === 0`) ainda reportava "success" — falso
  // positivo pra quem monitora `status` esperando convergência.
  const status =
    arquivosComErro === 0 && arquivosBackfilled === arquivosProcessados
      ? "success"
      : arquivosBackfilled > 0
        ? "partial"
        : "error";
  await finishLog(supabaseAdmin, logId, startedAt, {
    status,
    total_recebido: arquivosAlvo.length,
    total_inserido: linhasAtualizadas,
    total_ignorado: linhasNaoEncontradas + linhasPuladas,
    metadata: {
      detalhes,
      arquivos_restantes: arquivosRestantes,
      arquivos_sem_storage_path: arquivosSemStoragePath ?? 0,
      linhas_puladas: linhasPuladas,
    },
  });

  return json(200, {
    success: status !== "error",
    arquivos_encontrados: arquivosAlvo.length,
    arquivos_restantes: arquivosRestantes,
    // Arquivo sem storage_path é excluído da seleção acima (nunca
    // conseguiria baixar do bucket) — contado à parte pra não sumir da
    // resposta; não decresce reinvocando, exige intervenção manual
    // (achado do code-review).
    arquivos_sem_storage_path: arquivosSemStoragePath ?? 0,
    arquivos_processados: arquivosProcessados,
    arquivos_com_erro: arquivosComErro,
    linhas_atualizadas: linhasAtualizadas,
    linhas_puladas: linhasPuladas,
    linhas_nao_encontradas: linhasNaoEncontradas,
    detalhes,
  });
}

// ==================== runner: sync (extrato_eletronico_v10) ====================
// Lists SFTP files, diffs against getnet_arquivos, and imports missing files
// oldest-first up to batchSize. Called by cron and by the manual Sincronizar button.

async function runSyncExtratoV10(args: {
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
  batchSize: number;
}): Promise<Response> {
  const {
    supabaseAdmin, baseLogCtx, startedAt,
    host, port, path, username, password,
    filePatternRegex, contaId, integracao, batchSize,
  } = args;

  const defaultRegex = "^getnetextr_(\\d{4})(\\d{2})(\\d{2})_.+\\.txt$";
  const regexStr = filePatternRegex || defaultRegex;
  const fileRegex = new RegExp(regexStr, "i");

  const logId = await startLog(supabaseAdmin, {
    ...baseLogCtx,
    acao: "sync",
    metadata: { host, port, path, batch_size: batchSize },
  });

  // 1. List SFTP files matching the regex
  type SftpCandidate = { name: string; m: RegExpExecArray };
  const sftp = new SftpClient();
  let sftpCandidates: SftpCandidate[] = [];
  try {
    await sftp.connect({ host, port, username, password, readyTimeout: 20000 });
    const listing = (await sftp.list(path)) as any[];
    for (const f of listing) {
      if (f.type !== "-") continue;
      const m = fileRegex.exec(f.name);
      if (m && m.length >= 4) sftpCandidates.push({ name: f.name, m });
    }
    await sftp.end();
  } catch (sftpErr: any) {
    try { await sftp.end(); } catch (_) { /* ignore */ }
    await finishLog(supabaseAdmin, logId, startedAt, {
      status: "error",
      erro_mensagem: sftpErr?.message || "SFTP error",
      erro_stack: typeof sftpErr?.stack === "string" ? sftpErr.stack.slice(0, 4000) : null,
    });
    return json(200, { success: false, error: sftpErr?.message || "SFTP connection failed" });
  }

  // 2. Query already-imported filenames for this integration
  const { data: importedRows, error: dbErr } = await supabaseAdmin
    .from("getnet_arquivos")
    .select("arquivo_nome")
    .eq("integracao_id", integracao.id);

  if (dbErr) {
    await finishLog(supabaseAdmin, logId, startedAt, {
      status: "error",
      erro_mensagem: dbErr.message,
    });
    return json(200, { success: false, error: dbErr.message });
  }

  const importedSet = new Set<string>(
    (importedRows ?? []).map((r: any) => r.arquivo_nome as string)
  );

  // 3. Diff: files on SFTP not yet in DB, sorted oldest-first (YYYYMMDD prefix)
  const missing = sftpCandidates
    .filter((c) => !importedSet.has(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  const batch = missing.slice(0, batchSize);

  type ArquivoResult = {
    nome: string;
    data_referencia: string;
    status: string;
    totais?: Record<string, number>;
    erro?: string;
  };
  const resultArquivos: ArquivoResult[] = [];
  let totalInserido = 0;
  let totalIgnorado = 0;
  let errors = 0;

  // 4. Import each missing file by reusing runExtratoEletronicoV10
  for (const c of batch) {
    const dataReferencia = `${c.m[1]}-${c.m[2]}-${c.m[3]}`;
    try {
      const resp = await runExtratoEletronicoV10({
        supabaseAdmin,
        baseLogCtx,
        startedAt: Date.now(),
        host, port, path, username, password,
        filePatternRegex,
        contaId,
        integracao,
        dataReferencia,
        requestedFile: c.name,
      });
      const result = await resp.json();
      if (result.status === "success" || result.status === "partial") {
        resultArquivos.push({
          nome: c.name,
          data_referencia: dataReferencia,
          status: result.status,
          totais: result.totais,
        });
        totalInserido += result.totais?.total_inserido ?? 0;
        totalIgnorado += result.totais?.total_ignorado ?? 0;
      } else {
        errors++;
        resultArquivos.push({
          nome: c.name,
          data_referencia: dataReferencia,
          status: "erro",
          erro: result.error ?? "Falha desconhecida",
        });
      }
    } catch (e: any) {
      errors++;
      resultArquivos.push({
        nome: c.name,
        data_referencia: dataReferencia,
        status: "erro",
        erro: e?.message || String(e),
      });
    }
  }

  const processed = batch.length - errors;
  const finalStatus: "success" | "partial" | "error" =
    errors === 0 ? "success" : processed > 0 ? "partial" : "error";

  await finishLog(supabaseAdmin, logId, startedAt, {
    status: finalStatus,
    total_inserido: totalInserido,
    total_ignorado: totalIgnorado,
    metadata: {
      total_sftp: sftpCandidates.length,
      already_imported: importedSet.size,
      new_found: missing.length,
      batch: batch.length,
      processed,
      errors,
    },
  });

  return json(200, {
    success: finalStatus !== "error",
    status: finalStatus,
    total_sftp: sftpCandidates.length,
    already_imported: importedSet.size,
    new_found: missing.length,
    batch: batch.length,
    processed,
    errors,
    arquivos: resultArquivos,
  });
}
