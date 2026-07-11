import { callFinRpc, type FinResultado } from "./finRpc";

/**
 * Lançamento em lote de sessão de contagem (fin_lancar_sessao, ADR-029).
 * Substitui os inserts diretos do RelatorioOferta: conta é resolvida por
 * forma_pagamento_contas, status por formas_pagamento.gera_pago e taxa pela
 * forma — salvo override explícito por item.
 */

export interface ItemSessao {
  forma_pagamento_id: string;
  valor: number;
  conta_id?: string | null;
  categoria_id?: string | null;
  descricao?: string | null;
  pessoa_id?: string | null;
  origem_registro?: string | null;
  observacoes?: string | null;
  status?: "pendente" | "pago";
  taxas_administrativas?: number | null;
  data_pagamento?: string | null;
}

export function lancarSessao(
  sessaoId: string,
  itens: ItemSessao[],
  finalizar = true,
): Promise<FinResultado> {
  return callFinRpc("fin_lancar_sessao", {
    p_sessao_id: sessaoId,
    p_itens: itens,
    p_finalizar: finalizar,
  });
}
