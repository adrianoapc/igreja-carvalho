import { VincularTransacaoDialog } from "@/components/financas/VincularTransacaoDialog";
import { ConciliacaoLoteDialog } from "@/components/financas/ConciliacaoLoteDialog";
import { DividirExtratoDialog } from "@/components/financas/DividirExtratoDialog";
import {
  ResultadoReconciliacaoDialog,
  type MatchResult,
} from "@/components/financas/ResultadoReconciliacaoDialog";
import type { UseConciliacaoDialogsReturn } from "../hooks/useConciliacaoDialogs";

interface ConciliacaoDialogsProps {
  state: UseConciliacaoDialogsReturn;
  resultadoOpen: boolean;
  onResultadoOpenChange: (open: boolean) => void;
  resultados: MatchResult[];
  totalPendentes: number;
}

/**
 * Os 4 diálogos secundários da conciliação (vincular 1:1, dividir 1:N,
 * lote N:1, resultado da reconciliação automática) num único ponto —
 * ConciliacaoManual e DashboardConciliacao renderizavam essa mesma sequência
 * quase idêntica cada um por conta própria (F7 sub-frente 2/5).
 */
export function ConciliacaoDialogs({
  state,
  resultadoOpen,
  onResultadoOpenChange,
  resultados,
  totalPendentes,
}: ConciliacaoDialogsProps) {
  return (
    <>
      {state.selectedExtrato && (
        <VincularTransacaoDialog
          open={state.vincularOpen}
          onOpenChange={state.setVincularOpen}
          extrato={state.selectedExtrato}
          onVinculado={state.onChanged}
        />
      )}

      <DividirExtratoDialog
        open={state.dividirOpen}
        onOpenChange={state.setDividirOpen}
        extrato={state.selectedExtrato}
        onSuccess={state.onChanged}
      />

      {state.selectedTransacao && (
        <ConciliacaoLoteDialog
          open={state.loteOpen}
          onOpenChange={state.setLoteOpen}
          transacao={state.selectedTransacao}
          onConciliado={state.onChanged}
        />
      )}

      <ResultadoReconciliacaoDialog
        open={resultadoOpen}
        onOpenChange={onResultadoOpenChange}
        results={resultados}
        totalPendentes={totalPendentes}
      />
    </>
  );
}
