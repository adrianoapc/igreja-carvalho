import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { useDashboardConciliacaoData } from "./hooks/useDashboardConciliacaoData";
import { useAutoReconciliar } from "./hooks/useAutoReconciliar";
import { useConciliacaoDialogs } from "./hooks/useConciliacaoDialogs";
import { ConciliacaoDialogs } from "./components/ConciliacaoDialogs";
import { ConciliacaoStatsCards } from "./components/dashboard/ConciliacaoStatsCards";
import { AcoesRecentesCard } from "./components/dashboard/AcoesRecentesCard";
import { PendentesCard } from "./components/dashboard/PendentesCard";

/**
 * Dashboard de Conciliação — F7 sub-frente 2/5. Já usava grids responsivos
 * (`grid-cols-2 md:grid-cols-4`, `grid-cols-1 lg:grid-cols-3`) e cards
 * empilhados, então não tinha o problema crítico de colunas fixas do
 * ConciliacaoInteligente — esta rodada é decomposição + reaproveitamento dos
 * hooks compartilhados com ConciliacaoManual (useAutoReconciliar,
 * useConciliacaoDialogs).
 */
export function DashboardConciliacao() {
  const data = useDashboardConciliacaoData();
  const autoReconciliar = useAutoReconciliar();
  const dialogs = useConciliacaoDialogs(data.invalidarTudo);

  const handleReconciliarAutomatico = () => {
    autoReconciliar.executar({
      totalPendentesAtual: data.extratosPendentes?.length ?? 0,
      buscarCandidatos: data.buscarCandidatosAutoReconciliar,
      obterExtrato: data.obterExtrato,
      obterTransacao: data.obterTransacao,
    });
  };

  return (
    <div className="space-y-6">
      <ConciliacaoStatsCards
        pendentes={data.stats?.pendentes ?? 0}
        reconciliados={data.stats?.reconciliados ?? 0}
        lotes={data.stats?.lotes ?? 0}
        cobertura={data.stats?.cobertura ?? 0}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={data.selectedContaId} onValueChange={data.setSelectedContaId}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {data.contas?.map((conta) => (
              <SelectItem key={conta.id} value={conta.id}>
                {conta.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleReconciliarAutomatico}
          disabled={autoReconciliar.loading}
          className="w-full sm:w-auto sm:ml-auto"
        >
          {autoReconciliar.loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {autoReconciliar.loading ? "Reconciliando..." : "Reconciliar Automático"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <AcoesRecentesCard recentActions={data.recentActions} className="lg:col-span-1" />
        <PendentesCard
          extratosPendentes={data.extratosPendentes}
          transacoes={data.transacoes}
          sugestoes={data.sugestoes}
          onAceitarSugestao={data.handleAceitarSugestao}
          onVincular={dialogs.abrirVincular}
          onDividir={dialogs.abrirDividir}
          onIgnorar={data.handleIgnorar}
          className="lg:col-span-2"
        />
      </div>

      <ConciliacaoDialogs
        state={dialogs}
        resultadoOpen={autoReconciliar.resultadoOpen}
        onResultadoOpenChange={autoReconciliar.setResultadoOpen}
        resultados={autoReconciliar.resultados}
        totalPendentes={autoReconciliar.totalPendentes}
      />
    </div>
  );
}
