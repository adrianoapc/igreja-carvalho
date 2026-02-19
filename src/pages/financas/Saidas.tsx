import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  ArrowLeft,
  Calendar,
  TrendingDown,
  Building2,
  FileText,
  Upload,
  X,
  Download,
  ReceiptText,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  exportToExcel,
  formatDateForExport,
  formatCurrencyForExport,
  formatBooleanForExport,
} from "@/lib/exportUtils";
import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useCallback } from "react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { TransacaoDialog } from "@/components/financas/TransacaoDialog";
import {
  formatLocalDate,
  startOfMonthLocal,
  endOfMonthLocal,
  startOfDayLocal,
  endOfDayLocal,
} from "@/utils/dateUtils";
import { useTransacoesFiltro } from "@/hooks/useTransacoesFiltro";
// import { ImportarExcelWizard } from "@/components/financas/ImportarExcelWizard";
import { TransacaoActionsMenu } from "@/components/financas/TransacaoActionsMenu";
import { ExtratoDetalheDrawer } from "@/components/financas/ExtratoDetalheDrawer";
import { FiltrosSheet } from "@/components/financas/FiltrosSheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  format,
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { useQueryClient } from "@tanstack/react-query";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { SaidasCalendario } from "@/components/financas/SaidasCalendario";
import { SaidasTimelineCalendario } from "@/components/financas/SaidasTimelineCalendario";

export default function Saidas() {
  const navigate = useNavigate();
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTransacao, setEditingTransacao] = useState<{
    id: string;
    descricao: string;
    valor: number;
    status: string;
    data_vencimento: string;
  } | null>(null);

  // MonthPicker states
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);

  // Memoized callbacks para MonthPicker
  const handleMonthChange = useCallback((date: Date) => {
    setSelectedMonth(date);
  }, []);
  const handleCustomRangeChange = useCallback(
    (range: { from: Date; to: Date } | null) => {
      setCustomRange(range);
    },
    [],
  );
  // Debug: log quando selectedMonth muda

  // Estados dos filtros
  const [busca, setBusca] = useState("");
  const [contaFilter, setContaFilter] = useState("all");
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [fornecedorFilter, setFornecedorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [conciliacaoStatusFilter, setConciliacaoStatusFilter] = useState("all");

  // Estados para agrupamento por data
  const [agruparPorData, setAgruparPorData] = useState(false);
  const [gruposExpandidos, setGruposExpandidos] = useState<Set<string>>(
    new Set(),
  );

  // Estado para alternar entre lista e calendário
  const [visaoCalendario, setVisaoCalendario] = useState(false);

  // Estado para drawer de extrato
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

  // Calcular datas de início e fim baseado no período selecionado
  const getDateRange = () => {
    if (customRange) {
      return {
        inicio: formatLocalDate(startOfDayLocal(customRange.from)),
        fim: formatLocalDate(endOfDayLocal(customRange.to)),
      };
    }

    return {
      inicio: formatLocalDate(startOfMonthLocal(selectedMonth)),
      fim: formatLocalDate(endOfMonthLocal(selectedMonth)),
    };
  };

  const dateRange = getDateRange();

  const {
    data: transacoes,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "saidas",
      igrejaId,
      filialId,
      isAllFiliais,
      selectedMonth,
      customRange,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      const dateRange = getDateRange();
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          `
          *,
          conta:conta_id(nome, id),
          categoria:categoria_id(nome, cor, id),
          subcategoria:subcategoria_id(nome),
          base_ministerial:base_ministerial_id(titulo),
          centro_custo:centro_custo_id(nome),
          fornecedor:fornecedor_id(nome, id),
          solicitacao_reembolso:solicitacao_reembolso_id(status)
        `,
        )
        .eq("tipo", "saida")
        .eq("igreja_id", igrejaId)
        .gte("data_vencimento", dateRange.inicio)
        .lte("data_vencimento", dateRange.fim)
        .order("data_vencimento", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;

      // Filtrar: exclui transações de reembolso que NÃO estão pagas
      return (
        data?.filter(
          (t) =>
            !t.solicitacao_reembolso_id ||
            t.solicitacao_reembolso?.status === "pago",
        ) || []
      );
    },
    enabled: !loading && !!igrejaId,
  });

  // Buscar contas, categorias e fornecedores para os filtros
  const { data: contas } = useQuery({
    queryKey: ["contas-filtro", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !loading && !!igrejaId,
  });

  const { data: categorias } = useQuery({
    queryKey: ["categorias-filtro-saida", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("ativo", true)
        .eq("tipo", "saida")
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !loading && !!igrejaId,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-filtro", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !loading && !!igrejaId,
  });

  // Inicializar mapa de conciliação vazio (será atualizado depois)
  const [conciliacaoMap, setConciliacaoMap] = useState<Map<string, boolean>>(
    new Map(),
  );

  // Aplicar filtros centralizados
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

  const transacaoIds = useMemo(
    () => transacoesFiltradas.map((transacao) => transacao.id),
    [transacoesFiltradas],
  );

  const { data: extratosConciliados = [] } = useQuery({
    queryKey: [
      "extratos-vinculados-saidas",
      igrejaId,
      filialId,
      isAllFiliais,
      transacaoIds,
    ],
    queryFn: async () => {
      if (!igrejaId || transacaoIds.length === 0) return [];
      let query = supabase
        .from("extratos_bancarios")
        .select("transacao_vinculada_id, reconciliado")
        .in("transacao_vinculada_id", transacaoIds)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !loading && !!igrejaId && transacaoIds.length > 0,
  });

  // Atualizar mapa de conciliação quando extratos mudam
  useEffect(() => {
    const map = new Map<string, boolean>();
    extratosConciliados.forEach((extrato) => {
      if (extrato.transacao_vinculada_id) {
        map.set(extrato.transacao_vinculada_id, !!extrato.reconciliado);
      }
    });
    // Só atualiza se mudou de fato
    let changed = false;
    if (map.size !== conciliacaoMap.size) {
      changed = true;
    } else {
      for (const [key, value] of map) {
        if (conciliacaoMap.get(key) !== value) {
          changed = true;
          break;
        }
      }
    }
    if (changed) {
      setConciliacaoMap(map);
    }
  }, [extratosConciliados, conciliacaoMap]);

  // Agrupar transações por data
  const transacoesAgrupadas = useMemo(() => {
    if (!transacoesFiltradas) return {};

    const grupos: Record<string, typeof transacoesFiltradas> = {};

    transacoesFiltradas.forEach((transacao) => {
      const dataKey = format(
        new Date(transacao.data_vencimento + "T00:00:00"),
        "yyyy-MM-dd",
      );
      if (!grupos[dataKey]) {
        grupos[dataKey] = [];
      }
      grupos[dataKey].push(transacao);
    });

    return grupos;
  }, [transacoesFiltradas]);

  // Ordenar as datas dos grupos (mais recente primeiro)
  const datasOrdenadas = useMemo(() => {
    return Object.keys(transacoesAgrupadas).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime(),
    );
  }, [transacoesAgrupadas]);

  // Toggle de grupo expandido
  const toggleGrupo = (dataKey: string) => {
    const novosExpandidos = new Set(gruposExpandidos);
    if (novosExpandidos.has(dataKey)) {
      novosExpandidos.delete(dataKey);
    } else {
      novosExpandidos.add(dataKey);
    }
    setGruposExpandidos(novosExpandidos);
  };

  // Pagination
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
  } = usePagination(transacoesFiltradas, { pageSize: 20 });

  // Reset pagination when filters change
  useEffect(() => {
    // goToPage é estável, não precisa estar nas dependências
    goToPage(1);
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

  const formatCurrency = (value: number) => {
    return formatValue(value);
  };

  const isPagamentoDinheiro = (forma?: string | null) =>
    (forma || "").toLowerCase().includes("dinheiro");

  // Separar transferências das transações normais
  const transacoesNormais =
    transacoesFiltradas?.filter((t) => !t.transferencia_id) || [];
  const transferencias =
    transacoesFiltradas?.filter((t) => t.transferencia_id) || [];

  const totalSaidas =
    transacoesNormais?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPago =
    transacoesNormais
      ?.filter((t) => t.status === "pago")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPendente =
    transacoesNormais
      ?.filter((t) => t.status === "pendente")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalTransferencias =
    transferencias?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pago":
        return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
      case "pendente":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";
      case "atrasado":
        return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  type TransacaoResumo = { status: string; data_vencimento: string | Date };

  const getStatusDisplay = (transacao: TransacaoResumo) => {
    if (transacao.status === "pago") return "Pago";
    if (transacao.status === "pendente") {
      const hoje = new Date();
      const vencimento = new Date(transacao.data_vencimento + "T00:00:00");
      if (vencimento < hoje) {
        return "Atrasado";
      }
      return "Pendente";
    }
    return "Atrasado";
  };

  const getStatusColorDynamic = (transacao: TransacaoResumo) => {
    if (transacao.status === "pago") {
      return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400";
    }
    if (transacao.status === "pendente") {
      const hoje = new Date();
      const vencimento = new Date(transacao.data_vencimento + "T00:00:00");
      if (vencimento < hoje) {
        return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
      }
      return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400";
    }
    return "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400";
  };

  const handleExportar = () => {
    try {
      if (!transacoesFiltradas || transacoesFiltradas.length === 0) {
        toast.error("Não há dados para exportar");
        return;
      }

      const dadosExportacao = transacoesFiltradas.map((t) => ({
        Descrição: t.descricao,
        Valor: formatCurrencyForExport(t.valor),
        Status: getStatusDisplay(t),
        Conciliado: formatBooleanForExport(!!conciliacaoMap.get(t.id)),
        "Conferido Manual": formatBooleanForExport(!!t.conferido_manual),
        "Data Vencimento": formatDateForExport(t.data_vencimento),
        "Data Pagamento": formatDateForExport(t.data_pagamento),
        Conta: t.conta?.nome || "",
        Categoria: t.categoria?.nome || "",
        Subcategoria: t.subcategoria?.nome || "",
        Fornecedor: t.fornecedor?.nome || "",
        "Base Ministerial": t.base_ministerial?.titulo || "",
        "Centro de Custo": t.centro_custo?.nome || "",
        "Forma Pagamento": t.forma_pagamento || "",
        Observações: t.observacoes || "",
      }));

      exportToExcel(dadosExportacao, "Saidas", "Saídas");
      toast.success("Dados exportados com sucesso!");
    } catch (error) {
      console.error("Erro ao exportar:", error);
      toast.error("Erro ao exportar dados");
    }
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 md:gap-6">
        {/* Lado Esquerdo: Voltar + Título + HideValues */}
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
                Saídas
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-0.5">
                Gerencie os pagamentos da igreja
              </p>
            </div>
          </div>
          <HideValuesToggle />
        </div>

        {/* Lado Direito: Filtros + Novo */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end flex-wrap">
          <MonthPicker
            selectedMonth={selectedMonth}
            onMonthChange={handleMonthChange}
            customRange={customRange}
            onCustomRangeChange={handleCustomRangeChange}
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
            onLimpar={() => {
              setBusca("");
              setContaFilter("all");
              setCategoriaFilter("all");
              setFornecedorFilter("all");
              setStatusFilter("all");
              setConciliacaoStatusFilter("all");
              setSelectedMonth(new Date());
              setCustomRange(null);
            }}
            onAplicar={() => refetch()}
          />
          <Button
            variant="outline"
            onClick={() =>
              navigate("/financas/gerenciar-dados?tab=exportar&tipo=saida")
            }
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
            <span className="hidden sm:inline text-xs">Nova Saída</span>
            <span className="sm:hidden text-xs">Nova</span>
          </Button>
        </div>
      </div>

      <div>
        {/* Active Filters Display */}
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
            <Badge variant="secondary" className="gap-1.5 pr-1">
              Período customizado
              <button
                onClick={() => setCustomRange(null)}
                className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {busca && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              Busca: {busca}
              <button
                onClick={() => setBusca("")}
                className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {contaFilter !== "all" && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              Conta: {contas?.find((c) => c.id === contaFilter)?.nome}
              <button
                onClick={() => setContaFilter("all")}
                className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {categoriaFilter !== "all" && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              Categoria:{" "}
              {categorias?.find((c) => c.id === categoriaFilter)?.nome}
              <button
                onClick={() => setCategoriaFilter("all")}
                className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {fornecedorFilter !== "all" && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              Fornecedor:{" "}
              {fornecedores?.find((f) => f.id === fornecedorFilter)?.nome}
              <button
                onClick={() => setFornecedorFilter("all")}
                className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              Status:{" "}
              {statusFilter === "pendente"
                ? "Pendente"
                : statusFilter === "pago"
                  ? "Pago"
                  : "Atrasado"}
              <button
                onClick={() => setStatusFilter("all")}
                className="ml-1 hover:bg-background/50 rounded-sm p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          )}
        </div>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">
                  {formatCurrency(totalSaidas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pago</p>
                <p className="text-lg font-bold">{formatCurrency(totalPago)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-yellow-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendente</p>
                <p className="text-lg font-bold">
                  {formatCurrency(totalPendente)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Transferências</p>
                <p className="text-lg font-bold">
                  {formatCurrency(totalTransferencias)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de Transações */}
      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg md:text-xl">
              {visaoCalendario ? "Calendário de Saídas" : agruparPorData ? "Saídas (Agrupadas)" : "Lista de Saídas"}
            </CardTitle>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={!visaoCalendario && !agruparPorData ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setVisaoCalendario(false);
                        setAgruparPorData(false);
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
                      variant={!visaoCalendario && agruparPorData ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setVisaoCalendario(false);
                        setAgruparPorData(true);
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
        <CardContent className="p-4 md:p-6 pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Carregando...
            </p>
          ) : transacoesFiltradas && transacoesFiltradas.length > 0 ? (
            <>
              {visaoCalendario ? (
                customRange ? (
                  <SaidasTimelineCalendario
                    dataInicio={formatLocalDate(customRange.from)}
                    dataFim={formatLocalDate(customRange.to)}
                    dadosPorDia={transacoesAgrupadas}
                  />
                ) : (
                  <SaidasCalendario
                    ano={selectedMonth.getFullYear()}
                    mes={selectedMonth.getMonth()}
                    dadosPorDia={transacoesAgrupadas}
                  />
                )
              ) : agruparPorData ? (
                <div className="space-y-3">
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
                        {/* Header do grupo */}
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
                            <div className="text-base font-bold text-red-600">
                              {formatCurrency(totalGrupo)}
                            </div>
                          </div>
                        </button>

                        {/* Lista de transações do grupo */}
                        {isExpandido && (
                          <div className="divide-y">
                            {grupo.map((transacao) => {
                              const conciliacaoStatus =
                                transacao.conciliacao_status ||
                                (conciliacaoMap.get(transacao.id)
                                  ? "conciliado_extrato"
                                  : "nao_conciliado");
                              const isDinheiro = isPagamentoDinheiro(
                                transacao.forma_pagamento,
                              );
                              const isConferidoManual =
                                conciliacaoStatus === "nao_conciliado" &&
                                isDinheiro &&
                                !!transacao.conferido_manual;

                              return (
                                <div
                                  key={transacao.id}
                                  className="flex items-center gap-3 p-3 bg-card hover:bg-accent/50 transition-colors"
                                  onDoubleClick={() => {
                                    setEditingTransacao(transacao as any);
                                    setDialogOpen(true);
                                  }}
                                >
                                  {/* Data Compact - Mobile */}
                                  <div className="flex-shrink-0 text-center w-12 md:w-14">
                                    <div className="text-xs md:text-sm font-bold text-foreground">
                                      {format(
                                        new Date(
                                          transacao.data_vencimento +
                                            "T00:00:00",
                                        ),
                                        "dd",
                                        {
                                          locale: ptBR,
                                        },
                                      )}
                                    </div>
                                    <div className="text-[10px] md:text-xs text-muted-foreground uppercase">
                                      {format(
                                        new Date(
                                          transacao.data_vencimento +
                                            "T00:00:00",
                                        ),
                                        "MMM",
                                        {
                                          locale: ptBR,
                                        },
                                      )}
                                    </div>
                                  </div>

                                  {/* Divider */}
                                  <div className="h-10 w-px bg-border" />

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <h3 className="font-semibold text-sm md:text-base truncate flex-1">
                                        {transacao.descricao}
                                      </h3>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigator.clipboard.writeText(
                                            transacao.id,
                                          );
                                          toast.success("ID copiado!");
                                        }}
                                        className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
                                        title="Copiar ID"
                                      >
                                        {transacao.id.substring(0, 6)}
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                                      {transacao.fornecedor && (
                                        <>
                                          <span className="truncate">
                                            {transacao.fornecedor.nome}
                                          </span>
                                          {transacao.categoria && (
                                            <span>•</span>
                                          )}
                                        </>
                                      )}
                                      {transacao.categoria && (
                                        <>
                                          <span
                                            className="w-2 h-2 rounded-full flex-shrink-0"
                                            style={{
                                              backgroundColor:
                                                transacao.categoria.cor ||
                                                "#666",
                                            }}
                                          />
                                          <span className="truncate">
                                            {transacao.categoria.nome}
                                          </span>
                                        </>
                                      )}
                                      {transacao.conta && (
                                        <>
                                          <span>•</span>
                                          <span className="truncate">
                                            {transacao.conta.nome}
                                          </span>
                                        </>
                                      )}
                                    </div>
                                  </div>

                                  {/* Value & Actions */}
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    <div className="text-right">
                                      <div className="flex items-center gap-1.5 justify-end">
                                        <p className="text-base md:text-lg font-bold text-red-600 whitespace-nowrap">
                                          {formatCurrency(
                                            Number(transacao.valor),
                                          )}
                                        </p>
                                        {transacao.solicitacao_reembolso_id && (
                                          <TooltipProvider>
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                <Badge
                                                  variant="outline"
                                                  className="text-[10px] gap-1 border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400"
                                                >
                                                  <ReceiptText className="w-2.5 h-2.5" />
                                                </Badge>
                                              </TooltipTrigger>
                                              <TooltipContent>
                                                <p>Reembolso</p>
                                              </TooltipContent>
                                            </Tooltip>
                                          </TooltipProvider>
                                        )}
                                      </div>
                                      <div className="flex flex-wrap items-center justify-end gap-1 mt-1">
                                        <Badge
                                          className={`text-[10px] md:text-xs ${getStatusColorDynamic(
                                            transacao,
                                          )}`}
                                        >
                                          {getStatusDisplay(transacao)}
                                        </Badge>
                                        {conciliacaoStatus ===
                                        "conciliado_extrato" ? (
                                          <Badge className="text-[10px] md:text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                                            Conciliado (Extrato)
                                          </Badge>
                                        ) : conciliacaoStatus ===
                                          "conciliado_manual" ? (
                                          <Badge className="text-[10px] md:text-xs bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                                            Conciliado Manual
                                          </Badge>
                                        ) : conciliacaoStatus ===
                                          "conciliado_bot" ? (
                                          <Badge className="text-[10px] md:text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                                            Conciliado Bot
                                          </Badge>
                                        ) : isConferidoManual ? (
                                          <Badge className="text-[10px] md:text-xs bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                                            Conferido
                                          </Badge>
                                        ) : null}
                                      </div>
                                    </div>
                                    <TransacaoActionsMenu
                                      transacaoId={transacao.id}
                                      status={transacao.status}
                                      tipo="saida"
                                      isReembolso={
                                        !!transacao.solicitacao_reembolso_id
                                      }
                                      isDinheiro={isDinheiro}
                                      conferidoManual={
                                        !!transacao.conferido_manual
                                      }
                                      conciliacaoStatus={conciliacaoStatus}
                                      onEdit={() => {
                                        console.log(
                                          "[DEBUG] onEdit chamado",
                                          transacao,
                                        );
                                        setEditingTransacao(transacao);
                                        setDialogOpen(true);
                                      }}
                                      onVerExtrato={(extratoId, entrada) => {
                                        console.log(
                                          "[DEBUG] onVerExtrato chamado",
                                          { extratoId, entrada },
                                        );
                                        setExtratoSelecionado(extratoId);
                                        setEntradaVinculada(entrada || null);
                                        setExtratoDrawerOpen(true);
                                      }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {transacoesPaginadas.map((transacao) => {
                    const conciliacaoStatus =
                      transacao.conciliacao_status ||
                      (conciliacaoMap.get(transacao.id)
                        ? "conciliado_extrato"
                        : "nao_conciliado");
                    const isDinheiro = isPagamentoDinheiro(
                      transacao.forma_pagamento,
                    );
                    const isConferidoManual =
                      conciliacaoStatus === "nao_conciliado" &&
                      isDinheiro &&
                      !!transacao.conferido_manual;

                    return (
                      <div
                        key={transacao.id}
                        className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                        onDoubleClick={() => {
                          setEditingTransacao(transacao as any);
                          setDialogOpen(true);
                        }}
                      >
                        {/* Data Compact - Mobile */}
                        <div className="flex-shrink-0 text-center w-12 md:w-14">
                          <div className="text-xs md:text-sm font-bold text-foreground">
                            {format(
                              new Date(transacao.data_vencimento + "T00:00:00"),
                              "dd",
                              {
                                locale: ptBR,
                              },
                            )}
                          </div>
                          <div className="text-[10px] md:text-xs text-muted-foreground uppercase">
                            {format(
                              new Date(transacao.data_vencimento + "T00:00:00"),
                              "MMM",
                              {
                                locale: ptBR,
                              },
                            )}
                          </div>
                        </div>

                        {/* Divider */}
                        <div className="h-10 w-px bg-border" />

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-semibold text-sm md:text-base truncate flex-1">
                              {transacao.descricao}
                            </h3>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(transacao.id);
                                toast.success("ID copiado!");
                              }}
                              className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
                              title="Copiar ID"
                            >
                              {transacao.id.substring(0, 6)}
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            {transacao.fornecedor && (
                              <>
                                <span className="truncate">
                                  {transacao.fornecedor.nome}
                                </span>
                                {transacao.categoria && <span>•</span>}
                              </>
                            )}
                            {transacao.categoria && (
                              <>
                                <span
                                  className="w-2 h-2 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor:
                                      transacao.categoria.cor || "#666",
                                  }}
                                />
                                <span className="truncate">
                                  {transacao.categoria.nome}
                                </span>
                              </>
                            )}
                            {transacao.conta && (
                              <>
                                <span>•</span>
                                <span className="truncate">
                                  {transacao.conta.nome}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Value & Actions */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-right">
                            <div className="flex items-center gap-1.5 justify-end">
                              <p className="text-base md:text-lg font-bold text-red-600 whitespace-nowrap">
                                {formatCurrency(Number(transacao.valor))}
                              </p>
                              {transacao.solicitacao_reembolso_id && (
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] gap-1 border-indigo-300 text-indigo-600 dark:border-indigo-700 dark:text-indigo-400"
                                      >
                                        <ReceiptText className="w-2.5 h-2.5" />
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <p>Reembolso</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-1 mt-1">
                              <Badge
                                className={`text-[10px] md:text-xs ${getStatusColorDynamic(
                                  transacao,
                                )}`}
                              >
                                {getStatusDisplay(transacao)}
                              </Badge>
                              {conciliacaoStatus === "conciliado_extrato" ? (
                                <Badge className="text-[10px] md:text-xs bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
                                  Conciliado (Extrato)
                                </Badge>
                              ) : conciliacaoStatus === "conciliado_manual" ? (
                                <Badge className="text-[10px] md:text-xs bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                                  Conciliado Manual
                                </Badge>
                              ) : conciliacaoStatus === "conciliado_bot" ? (
                                <Badge className="text-[10px] md:text-xs bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                                  Conciliado Bot
                                </Badge>
                              ) : isConferidoManual ? (
                                <Badge className="text-[10px] md:text-xs bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                                  Conferido
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                          <TransacaoActionsMenu
                            transacaoId={transacao.id}
                            status={transacao.status}
                            tipo="saida"
                            isReembolso={!!transacao.solicitacao_reembolso_id}
                            isDinheiro={isDinheiro}
                            conferidoManual={!!transacao.conferido_manual}
                            conciliacaoStatus={conciliacaoStatus}
                            onEdit={() => {
                              setEditingTransacao(transacao);
                              setDialogOpen(true);
                            }}
                            onVerExtrato={(extratoId, entrada) => {
                              setExtratoSelecionado(extratoId);
                              setEntradaVinculada(entrada || null);
                              setExtratoDrawerOpen(true);
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pagination - apenas na visão lista */}
              {!agruparPorData && !visaoCalendario && (
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
              Nenhuma saída encontrada para o período selecionado.
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
        tipo="saida"
        transacao={editingTransacao}
      />

      <ExtratoDetalheDrawer
        extratoId={extratoSelecionado}
        open={extratoDrawerOpen}
        onOpenChange={(open) => {
          console.log("[DEBUG] ExtratoDetalheDrawer onOpenChange", open);
          setExtratoDrawerOpen(open);
        }}
        entradaVinculada={entradaVinculada}
      />

      {/** Import via página dedicada; wizard modal desativado */}
    </div>
  );
}
