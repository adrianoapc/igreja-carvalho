import { useMemo } from "react";
import { isPagamentoDinheiro } from "@/features/financeiro/core";

export interface Transacao {
  id: string;
  descricao: string;
  valor: number | string;
  valor_liquido?: number | string | null;
  taxas_administrativas?: number | string | null;
  multas?: number | string | null;
  juros?: number | string | null;
  desconto?: number | string | null;
  data_vencimento: string;
  conta_id?: string;
  categoria_id?: string;
  fornecedor_id?: string;
  status: string;
  forma_pagamento_id?: string | null;
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
  conciliacaoMap?: ConciliacaoMap,
  formasDinheiroIds?: ReadonlySet<string>,
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
          const isDinheiro = isPagamentoDinheiro(t.forma_pagamento_id, formasDinheiroIds);
          if (!(conciliacao === "nao_conciliado" && isDinheiro && t.conferido_manual)) {
            return false;
          }
        } else if (conciliacao !== conciliacaoStatus) {
          return false;
        }
      }
      return true;
    });
  }, [transacoes, filtros, conciliacaoMap, formasDinheiroIds]);
}
