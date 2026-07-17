import { useState } from "react";
import type { ExtratoItem, TransacaoConciliacao } from "../model/types";

/**
 * Estado dos 4 diálogos secundários compartilhados por ConciliacaoManual e
 * DashboardConciliacao: vincular 1:1, dividir 1:N, conciliar em lote N:1 e o
 * resultado da reconciliação automática (este último fica em
 * `useAutoReconciliar`, não aqui — motivos de escopo diferentes).
 */
export function useConciliacaoDialogs(onChanged: () => void) {
  const [selectedExtrato, setSelectedExtrato] = useState<ExtratoItem | null>(null);
  const [vincularOpen, setVincularOpen] = useState(false);
  const [dividirOpen, setDividirOpen] = useState(false);

  const [selectedTransacao, setSelectedTransacao] =
    useState<TransacaoConciliacao | null>(null);
  const [loteOpen, setLoteOpen] = useState(false);

  const abrirVincular = (extrato: ExtratoItem) => {
    setSelectedExtrato(extrato);
    setVincularOpen(true);
  };

  const abrirDividir = (extrato: ExtratoItem) => {
    setSelectedExtrato(extrato);
    setDividirOpen(true);
  };

  const abrirLote = (transacao: TransacaoConciliacao) => {
    setSelectedTransacao(transacao);
    setLoteOpen(true);
  };

  return {
    selectedExtrato,
    vincularOpen,
    setVincularOpen,
    dividirOpen,
    setDividirOpen,
    selectedTransacao,
    loteOpen,
    setLoteOpen,
    abrirVincular,
    abrirDividir,
    abrirLote,
    onChanged,
  };
}

export type UseConciliacaoDialogsReturn = ReturnType<typeof useConciliacaoDialogs>;
