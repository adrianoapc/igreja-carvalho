import { callFinRpc, type FinResultado } from "./finRpc";

/**
 * Pagamento de reembolso (fin_pagar_reembolso, ADR-029/ADR-001):
 * transação de caixa + status da solicitação + notificação ao solicitante,
 * numa única transação. D9: admin OU tesoureiro.
 */
export function pagarReembolso(input: {
  solicitacao_id: string;
  conta_id: string;
  data_pagamento?: string; // YYYY-MM-DD
  forma_pagamento?: string;
  observacoes?: string;
}): Promise<FinResultado> {
  return callFinRpc("fin_pagar_reembolso", {
    p_solicitacao_id: input.solicitacao_id,
    p_conta_id: input.conta_id,
    p_dados: {
      data_pagamento: input.data_pagamento,
      forma_pagamento: input.forma_pagamento,
      observacoes: input.observacoes,
    },
  });
}
