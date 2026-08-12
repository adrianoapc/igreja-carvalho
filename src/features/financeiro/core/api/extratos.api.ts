import { callFinRpc, type FinResultado } from "./finRpc";

/**
 * Wrappers da porta única de ingestão de extratos (ADR-028 / F5).
 * Substituem os INSERTs diretos em `extratos_bancarios` por uma RPC que
 * valida tenant/filial, normaliza valor (ABS + direção em `tipo`), deduplica
 * por `(conta_id, external_id)` e registra job + auditoria.
 */

export type OrigemExtrato =
  | "manual"
  | "arquivo_ofx"
  | "arquivo_csv"
  | "arquivo_xlsx"
  | "api_santander"
  | "getnet_sftp"
  | "getnet_sftp_txt"
  | "getnet_sftp_tipo5"
  | "pix";

/**
 * Origens que são o espelho sintético do próprio pipeline Getnet (settlement_v1,
 * extrato_eletronico_v10 tipo1/tipo5) — não são um crédito/débito bancário
 * real. Mesma lista de `public.fin_e_espelho_getnet` no banco
 * (`supabase/migrations/20260812130000_fin_hop1_exclui_espelho_getnet.sql`) —
 * centralizada aqui pra qualquer query client-side em `extratos_bancarios`
 * que precise excluir essas linhas (achado do code-review: sem isso, cada
 * call site copiava a lista à mão, e uma origem nova adicionada no banco
 * facilmente ficava fora de sync no frontend).
 */
export const ORIGENS_ESPELHO_GETNET: readonly OrigemExtrato[] = [
  "getnet_sftp",
  "getnet_sftp_txt",
  "getnet_sftp_tipo5",
];

/**
 * Filtro PostgREST (`.or(...)`) NULL-safe pra excluir o espelho Getnet de
 * uma query em `extratos_bancarios` — `origem IS NULL` nunca é descartado
 * (mesmo motivo do guard SQL: `NOT (origem IN (...))` é NULL, não TRUE,
 * pra `origem` nulo, e o PostgREST/SQL filtram NULL fora do WHERE).
 */
export const FILTRO_EXCLUI_ESPELHO_GETNET = `origem.is.null,origem.not.in.(${ORIGENS_ESPELHO_GETNET.join(",")})`;

export interface ExtratoItem {
  /** Data da transação em ISO (yyyy-mm-dd). */
  data_transacao: string;
  /** Valor bruto; o banco normaliza para ABS (a direção fica em `tipo`). */
  valor: number;
  tipo: "credito" | "debito";
  descricao: string;
  /** ID do provedor (FITID/transactionId); se ausente, o banco gera um determinístico. */
  external_id?: string;
  numero_documento?: string | null;
  saldo?: number | null;
}

/** → fin_ingerir_extratos. Retorna { job_id, inseridos, duplicados, total }. */
export function ingerirExtratos(
  contaId: string,
  origem: OrigemExtrato,
  itens: ExtratoItem[],
): Promise<FinResultado> {
  return callFinRpc("fin_ingerir_extratos", {
    p_conta_id: contaId,
    p_origem: origem,
    p_itens: itens,
  });
}

/** → fin_desfazer_ingestao. Remove os extratos NÃO conciliados do job. */
export function desfazerIngestao(jobId: string): Promise<FinResultado> {
  return callFinRpc("fin_desfazer_ingestao", { p_job_id: jobId });
}

/**
 * → fin_marcar_extrato_ignorado. Alterna `reconciliado` de um extrato SEM
 * vínculo de conciliação (F7) — "ignorar"/"reativar" ruído do extrato.
 * Recusa extrato vinculado (1:1/lote/divisão); use `desconciliar` nesses casos.
 */
export function marcarExtratoIgnorado(
  extratoId: string,
  ignorado: boolean,
): Promise<FinResultado> {
  return callFinRpc("fin_marcar_extrato_ignorado", {
    p_extrato_id: extratoId,
    p_ignorado: ignorado,
  });
}
