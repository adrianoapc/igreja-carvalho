import { useMemo } from "react";

export interface Transacao {
  id: string;
  descricao: string;
  conta_id?: string;
  categoria_id?: string;
  fornecedor_id?: string;
  status: string;
  forma_pagamento?: string;
  conferido_manual?: boolean;
  conciliacao_status?: string;
  [key: string]: any;
}

export type ConciliacaoMap = Map<string, boolean>;

export interface FiltrosTransacao {
  busca: string;
  contaId: string;
  categoriaId: string;
  fornecedorId: string;
  status: string;
  conciliacaoStatus: string;
}

export function useTransacoesFiltro(
  transacoes: Transacao[] | undefined,
  filtros: FiltrosTransacao,
  conciliacaoMap?: ConciliacaoMap
) {
  return useMemo(() => {
    if (!transacoes) return [];
    const {
      busca,
      contaId,
      categoriaId,
      fornecedorId,
      status,
      conciliacaoStatus,
    } = filtros;

    return transacoes.filter((t) => {
      if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) {
        return false;
      }
      if (contaId !== "all" && t.conta_id !== contaId) {
        return false;
      }
      if (categoriaId !== "all" && t.categoria_id !== categoriaId) {
        return false;
      }
      if (fornecedorId !== "all" && t.fornecedor_id !== fornecedorId) {
        return false;
      }
      if (status !== "all" && t.status !== status) {
        return false;
      }
      // Filtro de conciliação
      const conciliacao = t.conciliacao_status || (conciliacaoMap && conciliacaoMap.get(t.id) ? "conciliado_extrato" : "nao_conciliado");
      if (conciliacaoStatus !== "all") {
        if (conciliacaoStatus === "conferido_manual") {
          if (!(conciliacao === "nao_conciliado" && t.forma_pagamento?.toLowerCase().includes("dinheiro") && t.conferido_manual)) {
            return false;
          }
        } else if (conciliacao !== conciliacaoStatus) {
          return false;
        }
      }
      return true;
    });
  }, [transacoes, filtros, conciliacaoMap]);
}
