export type TipoTransacao = "entrada" | "saida";

export type StatusTransacao = "pendente" | "pago" | "cancelado";

/** Eixo de data usado para filtrar/ordenar listagens por período: data
 * prevista (vencimento) ou data em que o dinheiro moveu (pagamento —
 * coluna única compartilhada por entrada/recebimento e saída/pagamento). */
export type TipoDataFiltro = "vencimento" | "pagamento";

export const TIPO_DATA_FILTRO_DEFAULT: TipoDataFiltro = "vencimento";

export function colunaDataFiltro(
  tipoData: TipoDataFiltro,
): "data_vencimento" | "data_pagamento" {
  return tipoData === "pagamento" ? "data_pagamento" : "data_vencimento";
}

export interface TransacaoResumo {
  status: string;
  data_vencimento?: string | Date | null;
}
