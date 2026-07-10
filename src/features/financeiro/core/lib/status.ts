import type { TipoTransacao, TransacaoResumo } from "../model/types";

const BADGE_PAGO =
  "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
const BADGE_PENDENTE =
  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";
const BADGE_ATRASADO =
  "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
const BADGE_DEFAULT =
  "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400";

export const getStatusColor = (status: string) => {
  switch (status) {
    case "pago":
      return BADGE_PAGO;
    case "pendente":
      return BADGE_PENDENTE;
    case "atrasado":
      return BADGE_ATRASADO;
    default:
      return BADGE_DEFAULT;
  }
};

const isVencida = (transacao: TransacaoResumo) => {
  const hoje = new Date();
  const vencimento = new Date(transacao.data_vencimento + "T00:00:00");
  return vencimento < hoje;
};

export const getStatusDisplay = (
  transacao: TransacaoResumo,
  tipo: TipoTransacao,
) => {
  if (transacao.status === "pago") {
    return tipo === "entrada" ? "Recebido" : "Pago";
  }
  if (transacao.status === "pendente") {
    return isVencida(transacao) ? "Atrasado" : "Pendente";
  }
  return "Atrasado";
};

export const getStatusColorDynamic = (transacao: TransacaoResumo) => {
  if (transacao.status === "pago") return BADGE_PAGO;
  if (transacao.status === "pendente") {
    return isVencida(transacao) ? BADGE_ATRASADO : BADGE_PENDENTE;
  }
  return BADGE_ATRASADO;
};

export const isPagamentoDinheiro = (forma?: string | null) =>
  (forma || "").toLowerCase().includes("dinheiro");
