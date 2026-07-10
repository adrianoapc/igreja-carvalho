export type TipoTransacao = "entrada" | "saida";

export type StatusTransacao = "pendente" | "pago" | "cancelado";

export interface TransacaoResumo {
  status: string;
  data_vencimento?: string | Date | null;
}
