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
