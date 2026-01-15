import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  createClient,
  SupabaseClient,
} from "https://esm.sh/@supabase/supabase-js@2.43.4";
import forge from "npm:node-forge@1.3.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TOKEN_URL =
  "https://trust-open.api.santander.com.br/auth/oauth/v2/token";
const STATEMENTS_BASE_URL =
  "https://trust-open.api.santander.com.br/bank_account_information/v1";

type SantanderAction = "saldo" | "extrato";

interface SantanderRequest {
  action: SantanderAction;
  igrejaId: string;
  filialId?: string | null;
  contaId?: string | null;
  bankId: string;
  agencia: string;
  conta: string;
  initialDate?: string;
  finalDate?: string;
  offset?: number;
  limit?: number;
  _offset?: number;
  _limit?: number;
}

interface SantanderTransaction {
  data_transacao: string;
  descricao: string;
  valor: number;
  saldo: number | null;
  numero_documento: string | null;
  tipo: "credito" | "debito";
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders,
    },
  });
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function buildDedupeKey(entry: SantanderTransaction) {
  const docOrDesc = entry.numero_documento || entry.descricao;
  return `${entry.data_transacao}::${entry.valor}::${docOrDesc}`;
}

function pfxToPem(pfxBase64: string, password: string) {
  const pfxDer = forge.util.decode64(pfxBase64);
  const pfxAsn1 = forge.asn1.fromDer(pfxDer);
  const pfx = forge.pkcs12.pkcs12FromAsn1(pfxAsn1, password);

  const keyBags = pfx.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })
    .pkcs8ShroudedKeyBag;
  if (!keyBags || keyBags.length === 0) {
    throw new Error("Chave privada não encontrada no PFX");
  }
  const privateKey = forge.pki.privateKeyToPem(keyBags[0].key);

  const certBags = pfx.getBags({ bagType: forge.pki.oids.certBag }).certBag;
  if (!certBags || certBags.length === 0) {
    throw new Error("Certificado não encontrado no PFX");
  }
  const certChain = certBags.map((bag) => forge.pki.certificateToPem(bag.cert));

  return { privateKey, certChain };
}

async function getSantanderToken(httpClient: Deno.HttpClient) {
  const clientId = Deno.env.get("SANTANDER_CLIENT_ID");
  const clientSecret = Deno.env.get("SANTANDER_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("Credenciais Santander não configuradas");
  }

  const payload = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
  });

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
    client: httpClient,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Falha ao obter token Santander: ${errorText}`);
  }

  const tokenResponse = await response.json();
  if (!tokenResponse?.access_token) {
    throw new Error("Resposta do token sem access_token");
  }

  return tokenResponse.access_token as string;
}

function extractTransactions(payload: Record<string, unknown>) {
  const candidates = [
    payload?.transactions,
    payload?.data,
    payload?.items,
    payload?.statement,
    payload?.statementTransactions,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return null;
}

function mapSantanderTransaction(entry: Record<string, unknown>) {
  const dateValue =
    (entry.postingDate as string | undefined) ||
    (entry.transactionDate as string | undefined) ||
    (entry.date as string | undefined);
  const data_transacao = normalizeDate(dateValue);
  const valorRaw =
    (entry.amount as number | string | undefined) ??
    (entry.value as number | string | undefined);
  const valor = typeof valorRaw === "string" ? Number(valorRaw) : Number(valorRaw);
  const descricao =
    (entry.description as string | undefined) ||
    (entry.memo as string | undefined) ||
    (entry.historico as string | undefined) ||
    "";
  const saldoRaw =
    (entry.balance as number | string | undefined) ??
    (entry.saldo as number | string | undefined) ??
    null;
  const saldo =
    saldoRaw === null ? null : typeof saldoRaw === "string" ? Number(saldoRaw) : Number(saldoRaw);
  const numero_documento =
    (entry.transactionId as string | undefined) ||
    (entry.fitId as string | undefined) ||
    (entry.reference as string | undefined) ||
    (entry.id as string | undefined) ||
    null;
  const tipo = valor < 0 ? "debito" : "credito";

  if (!data_transacao || !descricao || Number.isNaN(valor)) {
    return null;
  }

  return {
    data_transacao,
    descricao,
    valor,
    saldo: Number.isNaN(saldo ?? NaN) ? null : saldo,
    numero_documento,
    tipo,
  } satisfies SantanderTransaction;
}

async function getExistingKeys(
  supabase: SupabaseClient,
  contaId: string,
  igrejaId: string,
  filialId: string | null | undefined,
  initialDate: string,
  finalDate: string,
) {
  let query = supabase
    .from("extratos_bancarios")
    .select("data_transacao, valor, numero_documento, descricao")
    .eq("conta_id", contaId)
    .eq("igreja_id", igrejaId)
    .gte("data_transacao", initialDate)
    .lte("data_transacao", finalDate);

  if (filialId) {
    query = query.eq("filial_id", filialId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Erro ao buscar extratos existentes: ${error.message}`);
  }

  return new Set(
    (data ?? []).map((row) => {
      const docOrDesc = row.numero_documento || row.descricao;
      return `${row.data_transacao}::${Number(row.valor)}::${docOrDesc}`;
    }),
  );
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não permitido" }, 405);
  }

  let payload: SantanderRequest;
  try {
    payload = await req.json();
  } catch (error) {
    return jsonResponse({ error: "Payload inválido" }, 400);
  }

  const {
    action,
    igrejaId,
    filialId,
    contaId,
    bankId,
    agencia,
    conta,
    initialDate,
    finalDate,
    offset,
    limit,
    _offset,
    _limit,
  } = payload;

  if (!action || !igrejaId || !bankId || !agencia || !conta) {
    return jsonResponse({ error: "Campos obrigatórios ausentes" }, 400);
  }

  const pageOffset = _offset ?? offset ?? 1;
  const pageLimit = _limit ?? limit ?? 50;

  if (action === "extrato" && (!contaId || !initialDate || !finalDate)) {
    return jsonResponse({
      error: "Para extrato, informe contaId, initialDate e finalDate",
    }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !supabaseKey) {
    return jsonResponse({ error: "Supabase env não configurado" }, 500);
  }

  const pfxBase64 = Deno.env.get("SANTANDER_PFX_B64");
  const pfxPassword = Deno.env.get("SANTANDER_PFX_PASSWORD") ?? "";
  if (!pfxBase64) {
    return jsonResponse({ error: "SANTANDER_PFX_B64 não configurado" }, 500);
  }

  let httpClient: Deno.HttpClient | null = null;

  try {
    const { privateKey, certChain } = pfxToPem(pfxBase64, pfxPassword);
    httpClient = Deno.createHttpClient({
      certChain,
      privateKey,
    });

    const token = await getSantanderToken(httpClient);
    const applicationKey = Deno.env.get("SANTANDER_APPLICATION_KEY");

    if (action === "saldo") {
      const url = `${STATEMENTS_BASE_URL}/banks/${bankId}/balances/${agencia}.${conta}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...(applicationKey ? { "x-application-key": applicationKey } : {}),
        },
        client: httpClient,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Erro ao consultar saldo: ${text}`);
      }

      const data = await response.json();
      return jsonResponse({ data });
    }

    const url = new URL(
      `${STATEMENTS_BASE_URL}/banks/${bankId}/statements/${agencia}.${conta}`,
    );
    url.searchParams.set("_offset", String(pageOffset));
    url.searchParams.set("_limit", String(pageLimit));
    url.searchParams.set("initialDate", initialDate ?? "");
    url.searchParams.set("finalDate", finalDate ?? "");

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        ...(applicationKey ? { "x-application-key": applicationKey } : {}),
      },
      client: httpClient,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Erro ao consultar extrato: ${text}`);
    }

    const data = await response.json();
    const transactions = extractTransactions(data as Record<string, unknown>);
    if (!transactions) {
      return jsonResponse({
        error: "Resposta não contém lista de transações",
        raw: data,
      }, 502);
    }

    const mapped = transactions
      .map((item: Record<string, unknown>) => mapSantanderTransaction(item))
      .filter((item): item is SantanderTransaction => Boolean(item));

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false },
    });

    const existingKeys = await getExistingKeys(
      supabase,
      contaId!,
      igrejaId,
      filialId ?? null,
      initialDate!,
      finalDate!,
    );

    const deduped = mapped.filter((entry) => {
      const key = buildDedupeKey(entry);
      return !existingKeys.has(key);
    });

    if (deduped.length === 0) {
      return jsonResponse({
        inserted: 0,
        received: mapped.length,
        ignored: mapped.length,
      });
    }

    const inserts = deduped.map((entry) => ({
      conta_id: contaId,
      igreja_id: igrejaId,
      filial_id: filialId,
      data_transacao: entry.data_transacao,
      descricao: entry.descricao,
      valor: entry.valor,
      saldo: entry.saldo,
      numero_documento: entry.numero_documento,
      tipo: entry.tipo,
      reconciliado: false,
    }));

    const { error } = await supabase
      .from("extratos_bancarios")
      .insert(inserts);

    if (error) {
      throw new Error(`Erro ao inserir extratos: ${error.message}`);
    }

    return jsonResponse({
      inserted: inserts.length,
      received: mapped.length,
      ignored: mapped.length - inserts.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
  } finally {
    httpClient?.close();
  }
});
