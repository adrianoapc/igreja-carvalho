import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Layers,
  FileText,
  ArrowRightLeft,
} from "lucide-react";
import { useState } from "react";
import { useConciliacaoManualData } from "./hooks/useConciliacaoManualData";
import { useAutoReconciliar } from "./hooks/useAutoReconciliar";
import { useConciliacaoDialogs } from "./hooks/useConciliacaoDialogs";
import { ConciliacaoDialogs } from "./components/ConciliacaoDialogs";
import { ManualFiltrosBar } from "./components/manual/ManualFiltrosBar";
import { ExtratoManualCard } from "./components/manual/ExtratoManualCard";
import { TransacaoManualCard } from "./components/manual/TransacaoManualCard";
import { PaginacaoCompacta } from "./components/manual/PaginacaoCompacta";

const ITEMS_PER_PAGE = 15;

const TIPO_OPTIONS_EXTRATO = [
  { value: "all", label: "Todos" },
  { value: "credito", label: "Crédito" },
  { value: "debito", label: "Débito" },
];

const TIPO_OPTIONS_TRANSACAO = [
  { value: "all", label: "Todos" },
  { value: "entrada", label: "Entrada" },
  { value: "saida", label: "Saída" },
];

/**
 * Conciliação Manual (Modo Clássico) — F7 sub-frente 2/5. Já usava `Tabs`
 * para alternar "Por Extrato"/"Por Transação" em qualquer viewport (não
 * tinha o problema de colunas fixas do ConciliacaoInteligente); esta rodada
 * é sobretudo decomposição — 1037 l. num arquivo só viram orquestrador +
 * hook de dados + subcomponentes focados, com um pouco de polimento
 * responsivo nas listas/filtros/paginação.
 */
export function ConciliacaoManual() {
  const [activeTab, setActiveTab] = useState<string>("extrato");
  const data = useConciliacaoManualData();
  const autoReconciliar = useAutoReconciliar();
  const dialogs = useConciliacaoDialogs(data.invalidarAposVinculo);

  const handleReconciliarAutomatico = () => {
    autoReconciliar.executar({
      totalPendentesAtual: data.extratosBrutos?.length ?? 0,
      buscarCandidatos: data.buscarCandidatosAutoReconciliar,
      obterExtrato: data.obterExtrato,
      obterTransacao: data.obterTransacao,
    });
  };

  const pendentes = data.extratosFiltrados.length;

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle className="text-lg">Conciliação Manual</CardTitle>
            {pendentes > 0 && <Badge variant="secondary">{pendentes} pendente(s)</Badge>}
          </div>
          <Button
            onClick={handleReconciliarAutomatico}
            size="sm"
            disabled={autoReconciliar.loading}
            className="w-full sm:w-auto"
          >
            <RefreshCw
              className={`w-4 h-4 mr-2 ${autoReconciliar.loading ? "animate-spin" : ""}`}
            />
            {autoReconciliar.loading ? "Reconciliando..." : "Reconciliar Automático"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="extrato" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Por Extrato
            </TabsTrigger>
            <TabsTrigger value="transacao" className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4" />
              Por Transação
            </TabsTrigger>
          </TabsList>

          {/* Tab: Por Extrato */}
          <TabsContent value="extrato" className="space-y-4 mt-4">
            <ManualFiltrosBar
              selectedMonth={data.selectedMonth}
              onMonthChange={data.setSelectedMonth}
              customRange={data.customRange}
              onCustomRangeChange={data.setCustomRange}
              searchPlaceholder="Buscar por descrição..."
              searchValue={data.searchTerm}
              onSearchChange={data.setSearchTerm}
              contas={data.contas}
              contaFiltro={data.selectedContaId}
              onContaFiltroChange={data.setSelectedContaId}
              tipoOptions={TIPO_OPTIONS_EXTRATO}
              tipoFiltro={data.tipoFiltro}
              onTipoFiltroChange={data.setTipoFiltro}
              origemFiltro={data.origemFiltro}
              onOrigemFiltroChange={data.setOrigemFiltro}
            />

            {pendentes === 0 && !data.loadingExtratos && (
              <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-start gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium text-green-900 dark:text-green-300">
                  Todos os extratos estão conciliados
                </p>
              </div>
            )}

            {data.loadingExtratos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {data.paginatedExtratos.map((extrato) => (
                      <ExtratoManualCard
                        key={extrato.id}
                        extrato={extrato}
                        onVincular={dialogs.abrirVincular}
                        onDividir={dialogs.abrirDividir}
                        onIgnorar={data.handleIgnorar}
                      />
                    ))}

                    {data.extratosFiltrados.length === 0 && !data.loadingExtratos && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Nenhum extrato pendente de conciliação
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Importe extratos na página de Contas para iniciar a conciliação
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <PaginacaoCompacta
                  page={data.currentPage}
                  totalPages={data.totalPages}
                  totalItems={data.extratosFiltrados.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={data.setCurrentPage}
                />
              </>
            )}
          </TabsContent>

          {/* Tab: Por Transação */}
          <TabsContent value="transacao" className="space-y-4 mt-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-start gap-2">
                <Layers className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 dark:text-blue-300">
                    Conciliação em Lote (N:1)
                  </p>
                  <p className="text-xs text-blue-700 dark:text-blue-400 mt-1">
                    Selecione uma transação do sistema para vincular múltiplos registros do
                    extrato bancário. Ideal para ofertas PIX consolidadas.
                  </p>
                </div>
              </div>
            </div>

            <ManualFiltrosBar
              selectedMonth={data.selectedMonth}
              onMonthChange={data.setSelectedMonth}
              customRange={data.customRange}
              onCustomRangeChange={data.setCustomRange}
              searchPlaceholder="Buscar transação por descrição ou categoria..."
              searchValue={data.transacaoSearchTerm}
              onSearchChange={data.setTransacaoSearchTerm}
              contas={data.contas}
              contaFiltro={data.transacaoContaFilter}
              onContaFiltroChange={data.setTransacaoContaFilter}
              tipoOptions={TIPO_OPTIONS_TRANSACAO}
              tipoFiltro={data.transacaoTipoFilter}
              onTipoFiltroChange={data.setTransacaoTipoFilter}
              origemFiltro={data.transacaoOrigemFilter}
              onOrigemFiltroChange={data.setTransacaoOrigemFilter}
            />

            {data.loadingTransacoes ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <ScrollArea className="h-[350px]">
                  <div className="space-y-2">
                    {data.paginatedTransacoes.map((transacao) => (
                      <TransacaoManualCard
                        key={transacao.id}
                        transacao={transacao}
                        onConciliarLote={dialogs.abrirLote}
                      />
                    ))}

                    {data.transacoesPendentes.length === 0 && !data.loadingTransacoes && (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <AlertCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
                        <p className="text-sm text-muted-foreground">
                          Nenhuma transação encontrada
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Ajuste os filtros ou verifique se há transações pagas nos últimos 90
                          dias
                        </p>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                <PaginacaoCompacta
                  page={data.transacaoPage}
                  totalPages={data.transacaoTotalPages}
                  totalItems={data.transacoesPendentes.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                  onPageChange={data.setTransacaoPage}
                />
              </>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>

      <ConciliacaoDialogs
        state={dialogs}
        resultadoOpen={autoReconciliar.resultadoOpen}
        onResultadoOpenChange={autoReconciliar.setResultadoOpen}
        resultados={autoReconciliar.resultados}
        totalPendentes={autoReconciliar.totalPendentes}
      />
    </Card>
  );
}
