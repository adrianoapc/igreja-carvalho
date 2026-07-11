import { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Plus,
  ArrowLeft,
  Calendar,
  FileText,
  Upload,
  X,
  Download,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { useHideValues } from "@/hooks/useHideValues";
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { useTransacoesFiltro } from "@/hooks/useTransacoesFiltro";
import { formatLocalDate } from "@/utils/dateUtils";
import { TransacaoDialog } from "@/components/financas/TransacaoDialog";
import { ExtratoDetalheDrawer } from "@/components/financas/ExtratoDetalheDrawer";
import { FiltrosSheet } from "@/components/financas/FiltrosSheet";
import { MonthPicker } from "@/components/financas/MonthPicker";
import {
  exportToExcel,
  formatDateForExport,
  formatBooleanForExport,
} from "@/lib/exportUtils";
import {
  agruparPorData,
  ordenarDatasDesc,
  getPeriodoRange,
  getStatusDisplay,
  useLancamentos,
  useDadosFiltros,
  useConciliacaoMap,
} from "@/features/financeiro/core";
import { TRANSACOES_PAGE_CONFIG } from "./transacoesPage.config";
import { LancamentoCard } from "./components/LancamentoCard";
import { LancamentosSkeleton } from "./components/LancamentosSkeleton";

/**
 * Página única de lançamentos, parametrizada por tipo (F2 do roadmap
 * ADR-029 §7.3). Entradas.tsx e Saidas.tsx são cascas de rota que apenas
 * re-exportam esta página com o tipo fixado.
 */

const CONCILIACAO_LABELS: Record<string, string> = {
  conciliado_extrato: "Conciliado (Extrato)",
  conciliado_manual: "Conciliado Manual",
  conciliado_bot: "Conciliado Bot",
  nao_conciliado: "Não Conciliado",
  conferido_manual: "Conferido Manual",
};

export function TransacoesPage({ tipo }: { tipo: "entrada" | "saida" }) {
  const config = TRANSACOES_PAGE_CONFIG[tipo];
  const navigate = useNavigate();
  const { formatValue } = useHideValues();

  const [dialogOpen, setDialogOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [editingTransacao, setEditingTransacao] = useState<any>(null);

  // Período
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);

  // Filtros
  const [busca, setBusca] = useState("");
  const [contaFilter, setContaFilter] = useState("all");
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [fornecedorFilter, setFornecedorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conciliacaoStatusFilter, setConciliacaoStatusFilter] = useState("all");

  // Visões
  const [agrupar, setAgrupar] = useState(false);
  const [visaoCalendario, setVisaoCalendario] = useState(false);
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(
    new Set(),
  );

  // Drawer de extrato
  const [extratoSelecionado, setExtratoSelecionado] = useState<string | null>(
    null,
  );
  const [entradaVinculada, setEntradaVinculada] = useState<{
    id: string;
    descricao: string;
    valor: number;
    data_pagamento: string;
  } | null>(null);
  const [extratoDrawerOpen, setExtratoDrawerOpen] = useState(false);

  const periodo = getPeriodoRange(selectedMonth, customRange);

  const { transacoes, isLoading, refetch } = useLancamentos(tipo, periodo);
  const { contas, categorias, fornecedores } = useDadosFiltros(tipo);

  const transacoesIds = useMemo(
    () => (transacoes || []).map((t) => t.id),
    [transacoes],
  );
  const conciliacaoMap = useConciliacaoMap(transacoesIds);

  const transacoesFiltradas = useTransacoesFiltro(
    transacoes,
    {
      busca,
      contaId: contaFilter,
      categoriaId: categoriaFilter,
      fornecedorId: fornecedorFilter,
      status: statusFilter,
      conciliacaoStatus: conciliacaoStatusFilter,
    },
    conciliacaoMap,
  );

  const transacoesAgrupadas = useMemo(
    () => agruparPorData(transacoesFiltradas),
    [transacoesFiltradas],
  );
  const datasOrdenadas = useMemo(
    () => ordenarDatasDesc(transacoesAgrupadas),
    [transacoesAgrupadas],
  );

  const {
    currentPage,
    totalPages,
    paginatedData: transacoesPaginadas,
    goToPage,
    hasNextPage,
    hasPrevPage,
    startIndex,
    endIndex,
    totalItems,
  } = usePagination(transacoesFiltradas, { pageSize: config.pageSize });

  useEffect(() => {
    goToPage(1);
    // goToPage é estável, não precisa estar nas dependências
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    busca,
    contaFilter,
    categoriaFilter,
    fornecedorFilter,
    statusFilter,
    selectedMonth,
    customRange,
  ]);

  const toggleGrupo = useCallback((dataKey: string) => {
    setGruposExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(dataKey)) {
        novo.delete(dataKey);
      } else {
        novo.add(dataKey);
      }
      return novo;
    });
  }, []);

  const formatCurrency = (value: number) => formatValue(value);

  // Resumo (transferências destacadas das transações normais)
  const transacoesNormais =
    transacoesFiltradas?.filter((t) => !t.transferencia_id) || [];
  const transferencias =
    transacoesFiltradas?.filter((t) => t.transferencia_id) || [];
  const total =
    transacoesNormais.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPago =
    transacoesNormais
      .filter((t) => t.status === "pago")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPendente =
    transacoesNormais
      .filter((t) => t.status === "pendente")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalTransferencias =
    transferencias.reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const abrirEdicao = (transacao: any) => {
    setEditingTransacao({
      ...transacao,
      valor: Number(transacao.valor),
      categoria_id: transacao.categoria_id ?? "none",
      subcategoria_id: transacao.subcategoria_id ?? "none",
      centro_custo_id: transacao.centro_custo_id ?? "none",
      base_ministerial_id: transacao.base_ministerial_id ?? "none",
      conta_id: transacao.conta_id ?? "",
      forma_pagamento: transacao.forma_pagamento ?? "",
    });
    setDialogOpen(true);
  };

  const handleVerExtrato = (
    extratoId: string,
    entrada?: {
      id: string;
      descricao: string;
      valor: number;
      data_pagamento: string;
    },
  ) => {
    setExtratoSelecionado(extratoId);
    setEntradaVinculada(entrada || null);
    setExtratoDrawerOpen(true);
  };

  const handleLimparFiltros = () => {
    setBusca("");
    setContaFilter("all");
    setCategoriaFilter("all");
    setFornecedorFilter("all");
    setStatusFilter("all");
    setConciliacaoStatusFilter("all");
    setSelectedMonth(new Date());
    setCustomRange(null);
  };

  const handleExportar = () => {
    try {
      if (!transacoesFiltradas || transacoesFiltradas.length === 0) {
        toast.error("Não há dados para exportar");
        return;
      }

      const dadosExportacao = transacoesFiltradas.map((t) => ({
        Descrição: t.descricao,
        Valor: t.valor,
        Status: getStatusDisplay(t, tipo),
        Conciliado: formatBooleanForExport(!!conciliacaoMap.get(t.id)),
        "Conferido Manual": formatBooleanForExport(!!t.conferido_manual),
        "Data Vencimento": formatDateForExport(t.data_vencimento),
        [config.exportDataPagamentoLabel]: formatDateForExport(
          t.data_pagamento,
        ),
        Conta: t.conta?.nome || "",
        Categoria: t.categoria?.nome || "",
        Subcategoria: t.subcategoria?.nome || "",
        Fornecedor: t.fornecedor?.nome || "",
        "Base Ministerial": t.base_ministerial?.titulo || "",
        "Centro de Custo": t.centro_custo?.nome || "",
        "Forma Pagamento": t.forma_pagamento || "",
        Observações: t.observacoes || "",
      }));

      exportToExcel(dadosExportacao, config.exportNome, config.titulo, {
        Valor: "#,##0.00",
      });
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar dados");
    }
  };
  void handleExportar; // exportação via página Arquivos; mantido para atalho futuro

  const TotalIcone = config.totalIcone;
  const { Calendario, TimelineCalendario } = config;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        <div className="flex items-center justify-between gap-3 min-w-0 flex-1">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/financas")}
              className="flex-shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {config.titulo}
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-0.5">
                {config.subtitulo}
              </p>
            </div>
          </div>
          <HideValuesToggle />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
          <MonthPicker
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
          <FiltrosSheet
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
            busca={busca}
            setBusca={setBusca}
            contaId={contaFilter}
            setContaId={setContaFilter}
            categoriaId={categoriaFilter}
            setCategoriaId={setCategoriaFilter}
            fornecedorId={fornecedorFilter}
            setFornecedorId={setFornecedorFilter}
            status={statusFilter}
            setStatus={setStatusFilter}
            conciliacaoStatus={conciliacaoStatusFilter}
            setConciliacaoStatus={setConciliacaoStatusFilter}
            contas={contas || []}
            categorias={categorias || []}
            fornecedores={fornecedores || []}
            tipoTransacao={tipo}
            onLimpar={handleLimparFiltros}
            onAplicar={() => refetch()}
          />
          <Button
            variant="outline"
            onClick={() => navigate(config.arquivosTab)}
            size="sm"
          >
            <span className="flex items-center gap-1 mr-1">
              <Download className="w-4 h-4" />
              <Upload className="w-4 h-4" />
            </span>
            <span className="hidden sm:inline text-xs">Arquivos</span>
          </Button>
          <Button
            className="bg-gradient-primary shadow-soft whitespace-nowrap"
            onClick={() => setDialogOpen(true)}
            size="sm"
          >
            <Plus className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline text-xs">{config.novoLabel}</span>
            <span className="sm:hidden text-xs">Nova</span>
          </Button>
        </div>
      </div>

      {/* Filtros ativos */}
      <div className="flex flex-wrap gap-2 mt-3">
        <Badge variant="outline" className="gap-1.5">
          <Calendar className="w-3 h-3" />
          {customRange
            ? `${format(customRange.from, "dd/MM/yyyy")} - ${format(
                customRange.to,
                "dd/MM/yyyy",
              )}`
            : format(selectedMonth, "MMMM 'de' yyyy", { locale: ptBR })}
        </Badge>
        {customRange && (
          <FiltroBadge label="Período customizado" onClear={() => setCustomRange(null)} />
        )}
        {busca && (
          <FiltroBadge label={`Busca: ${busca}`} onClear={() => setBusca("")} />
        )}
        {statusFilter !== "all" && (
          <FiltroBadge
            label={`Status: ${
              statusFilter === "pendente"
                ? "Pendente"
                : statusFilter === "pago"
                  ? config.totalLabelPago
                  : "Atrasado"
            }`}
            onClear={() => setStatusFilter("all")}
          />
        )}
        {conciliacaoStatusFilter !== "all" && (
          <FiltroBadge
            label={`Conciliação: ${
              CONCILIACAO_LABELS[conciliacaoStatusFilter] ||
              conciliacaoStatusFilter
            }`}
            onClear={() => setConciliacaoStatusFilter("all")}
          />
        )}
        {contaFilter !== "all" && (
          <FiltroBadge
            label={`Conta: ${contas?.find((c) => c.id === contaFilter)?.nome ?? ""}`}
            onClear={() => setContaFilter("all")}
          />
        )}
        {categoriaFilter !== "all" && (
          <FiltroBadge
            label={`Categoria: ${categorias?.find((c) => c.id === categoriaFilter)?.nome ?? ""}`}
            onClear={() => setCategoriaFilter("all")}
          />
        )}
        {fornecedorFilter !== "all" && (
          <FiltroBadge
            label={`Fornecedor: ${fornecedores?.find((f) => f.id === fornecedorFilter)?.nome ?? ""}`}
            onClear={() => setFornecedorFilter("all")}
          />
        )}
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <ResumoCard
          icone={<TotalIcone className="w-5 h-5 text-blue-600" />}
          fundo="bg-blue-100 dark:bg-blue-900/20"
          label="Total"
          valor={formatCurrency(total)}
        />
        <ResumoCard
          icone={<TotalIcone className="w-5 h-5 text-green-600" />}
          fundo="bg-green-100 dark:bg-green-900/20"
          label={config.totalLabelPago}
          valor={formatCurrency(totalPago)}
        />
        <ResumoCard
          icone={<Calendar className="w-5 h-5 text-yellow-600" />}
          fundo="bg-yellow-100 dark:bg-yellow-900/20"
          label="Pendente"
          valor={formatCurrency(totalPendente)}
        />
        <ResumoCard
          icone={<ArrowLeft className="w-5 h-5 text-purple-600" />}
          fundo="bg-purple-100 dark:bg-purple-900/20"
          label="Transferências"
          valor={formatCurrency(totalTransferencias)}
        />
      </div>

      {/* Lista / Agrupado / Calendário */}
      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg md:text-xl">
              {visaoCalendario
                ? config.calendarioTitulo
                : agrupar
                  ? config.agrupadoTitulo
                  : config.listaTitulo}
            </CardTitle>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        !visaoCalendario && !agrupar ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        setVisaoCalendario(false);
                        setAgrupar(false);
                      }}
                    >
                      <FileText className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Lista</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={
                        !visaoCalendario && agrupar ? "default" : "outline"
                      }
                      size="sm"
                      onClick={() => {
                        setVisaoCalendario(false);
                        setAgrupar(true);
                        setGruposExpandidos(
                          new Set(Object.keys(transacoesAgrupadas)),
                        );
                      }}
                    >
                      <Layers className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Agrupar por Data</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={visaoCalendario ? "default" : "outline"}
                      size="sm"
                      onClick={() => setVisaoCalendario(true)}
                      className="hidden md:flex"
                    >
                      <Calendar className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Visão Calendário</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LancamentosSkeleton />
          ) : transacoesFiltradas && transacoesFiltradas.length > 0 ? (
            <>
              {visaoCalendario ? (
                <div className="p-4 md:p-6 pt-0">
                  {customRange ? (
                    <TimelineCalendario
                      dataInicio={formatLocalDate(customRange.from)}
                      dataFim={formatLocalDate(customRange.to)}
                      dadosPorDia={transacoesAgrupadas}
                    />
                  ) : (
                    <Calendario
                      ano={selectedMonth.getFullYear()}
                      mes={selectedMonth.getMonth()}
                      dadosPorDia={transacoesAgrupadas}
                    />
                  )}
                </div>
              ) : agrupar ? (
                <div className="space-y-3 p-4">
                  {datasOrdenadas.map((dataKey) => {
                    const grupo = transacoesAgrupadas[dataKey];
                    const totalGrupo = grupo.reduce(
                      (sum, t) => sum + Number(t.valor),
                      0,
                    );
                    const isExpandido = gruposExpandidos.has(dataKey);

                    return (
                      <div
                        key={dataKey}
                        className="border rounded-lg overflow-hidden"
                      >
                        <button
                          onClick={() => toggleGrupo(dataKey)}
                          className="w-full flex items-center justify-between p-3 bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            {isExpandido ? (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="w-5 h-5 text-muted-foreground" />
                            )}
                            <div className="text-left">
                              <div className="font-semibold text-sm">
                                {format(
                                  new Date(dataKey + "T00:00:00"),
                                  "dd 'de' MMMM 'de' yyyy",
                                  { locale: ptBR },
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {grupo.length}{" "}
                                {grupo.length === 1
                                  ? "transação"
                                  : "transações"}
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`text-base font-bold ${config.valorClass}`}
                            >
                              {formatCurrency(totalGrupo)}
                            </div>
                          </div>
                        </button>

                        {isExpandido && (
                          <div className="divide-y">
                            {grupo.map((transacao) => (
                              <LancamentoCard
                                key={transacao.id}
                                transacao={transacao}
                                tipo={tipo}
                                valorClass={config.valorClass}
                                conciliacaoMap={conciliacaoMap}
                                formatCurrency={formatCurrency}
                                onEdit={abrirEdicao}
                                onVerExtrato={handleVerExtrato}
                                bordered={false}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2 p-4 md:p-6 pt-0">
                  {transacoesPaginadas.map((transacao) => (
                    <LancamentoCard
                      key={transacao.id}
                      transacao={transacao}
                      tipo={tipo}
                      valorClass={config.valorClass}
                      conciliacaoMap={conciliacaoMap}
                      formatCurrency={formatCurrency}
                      onEdit={abrirEdicao}
                      onVerExtrato={handleVerExtrato}
                    />
                  ))}
                </div>
              )}

              {!agrupar && !visaoCalendario && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={goToPage}
                  startIndex={startIndex}
                  endIndex={endIndex}
                  totalItems={totalItems}
                  hasNextPage={hasNextPage}
                  hasPrevPage={hasPrevPage}
                />
              )}
            </>
          ) : (
            <p className="text-sm md:text-base text-muted-foreground text-center py-4">
              {config.vazioMensagem}
            </p>
          )}
        </CardContent>
      </Card>

      <TransacaoDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingTransacao(null);
        }}
        tipo={tipo}
        transacao={editingTransacao}
      />

      <ExtratoDetalheDrawer
        extratoId={extratoSelecionado}
        open={extratoDrawerOpen}
        onOpenChange={setExtratoDrawerOpen}
        entradaVinculada={entradaVinculada}
      />
    </div>
  );
}

function FiltroBadge({
  label,
  onClear,
}: {
  label: string;
  onClear: () => void;
}) {
  return (
    <Badge variant="secondary" className="gap-1.5 pr-1">
      {label}
      <button
        onClick={onClear}
        className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
      >
        <X className="w-3 h-3" />
      </button>
    </Badge>
  );
}

function ResumoCard({
  icone,
  fundo,
  label,
  valor,
}: {
  icone: React.ReactNode;
  fundo: string;
  label: string;
  valor: string;
}) {
  return (
    <Card className="shadow-soft">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${fundo}`}
          >
            {icone}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-bold">{valor}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
