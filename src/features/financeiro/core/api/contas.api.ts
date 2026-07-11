import { callFinRpc, type FinResultado } from "./finRpc";

/** Wrappers das RPCs de conta (ADR-029). */

/**
 * Ajuste de saldo auditável: cria um lançamento na categoria "Ajuste de
 * Saldo" e move o saldo pelo trigger — substitui o UPDATE direto de
 * contas.saldo_atual (que não deixava trilha).
 */
export function ajustarSaldo(input: {
  conta_id: string;
  valor: number;
  tipo: "entrada" | "saida";
  motivo?: string;
  data?: string; // YYYY-MM-DD
}): Promise<FinResultado> {
  return callFinRpc("fin_ajustar_saldo", {
    p_conta_id: input.conta_id,
    p_valor: input.valor,
    p_tipo: input.tipo,
    p_motivo: input.motivo ?? null,
    p_data: input.data ?? new Date().toISOString().slice(0, 10),
  });
}

/** Diagnóstico/correção de drift: saldo_inicial + Σ pagos. */
export function recalcularSaldoConta(
  contaId: string,
  aplicar = false,
): Promise<FinResultado> {
  return callFinRpc("fin_recalcular_saldo_conta", {
    p_conta_id: contaId,
    p_aplicar: aplicar,
  });
}
