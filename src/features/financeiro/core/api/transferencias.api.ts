import { callFinRpc, type FinResultado } from "./finRpc";

/** Wrappers das RPCs de transferência entre contas (ADR-029). */

export interface CriarTransferenciaInput {
  conta_origem_id: string;
  conta_destino_id: string;
  valor: number;
  data: string; // YYYY-MM-DD
  extras?: {
    categoria_saida_id?: string | null;
    categoria_entrada_id?: string | null;
    subcategoria_saida_id?: string | null;
    base_ministerial_id?: string | null;
    centro_custo_id?: string | null;
    descricao_saida?: string | null;
    descricao_entrada?: string | null;
    forma_pagamento?: string | null;
    observacoes?: string | null;
    anexo_url?: string | null;
    filial_id?: string | null;
  };
}

export function criarTransferencia(
  input: CriarTransferenciaInput,
): Promise<FinResultado> {
  return callFinRpc("fin_criar_transferencia", {
    p_conta_origem_id: input.conta_origem_id,
    p_conta_destino_id: input.conta_destino_id,
    p_valor: input.valor,
    p_data: input.data,
    p_extras: input.extras ?? {},
  });
}

/**
 * Estorno atômico: cancela as duas transações espelho (o trigger de saldo
 * reverte uma única vez) e marca a transferência como estornada.
 */
export function estornarTransferencia(transferenciaId: string): Promise<FinResultado> {
  return callFinRpc("fin_estornar_transferencia", {
    p_transferencia_id: transferenciaId,
  });
}
