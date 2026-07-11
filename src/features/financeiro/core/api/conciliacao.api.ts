import { callFinRpc, type FinResultado } from "./finRpc";

/**
 * Wrappers das RPCs de conciliação transacional (ADR-030 / F3).
 * Substituem a confirmação multi-tabela não transacional do frontend por
 * uma única transação no banco, cobrindo os três formatos de vínculo.
 */

export interface DivisaoItem {
  transacao_id: string;
  valor: number;
}

export interface VinculoConciliacao {
  extrato_ids: string[];
  transacao_ids: string[];
  /** Obrigatório no formato 1:N (1 extrato → N transações). */
  divisoes?: DivisaoItem[];
  sugestao_id?: string;
  score?: number;
}

/**
 * Confirma a conciliação numa transação atômica. O formato (1:1, N:1, 1:N)
 * é inferido pela cardinalidade de extrato_ids × transacao_ids:
 * - 1 extrato + 1 transação → 1:1
 * - N extratos + 1 transação → N:1 (lote)
 * - 1 extrato + N transações → 1:N (divisão; exige `divisoes`)
 */
export function confirmarConciliacao(
  vinculo: VinculoConciliacao,
): Promise<FinResultado> {
  return callFinRpc("fin_confirmar_conciliacao", { p_vinculo: vinculo });
}

/**
 * Desfaz a conciliação de uma transação, limpando os três mecanismos de
 * vínculo (1:1, lote, divisão). Não reverte pago→pendente (dinheiro que caiu
 * permanece pago; reconciliar de novo é no-op de saldo).
 */
export function desconciliar(transacaoId: string): Promise<FinResultado> {
  return callFinRpc("fin_desconciliar", { p_transacao_id: transacaoId });
}
