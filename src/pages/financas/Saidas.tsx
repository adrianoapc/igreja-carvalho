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
} from "@/lib/exportUtils";
import { useNavigate } from "react-router-dom";
import { useState, useMemo } from "react";
import { TransacaoDialog } from "@/components/financas/TransacaoDialog";
import { ImportarExcelDialog } from "@/components/financas/ImportarExcelDialog";
import { TransacaoActionsMenu } from "@/components/financas/TransacaoActionsMenu";
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

export default function Saidas() {
  const navigate = useNavigate();
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
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

  // Estados dos filtros
  const [busca, setBusca] = useState("");
  const [contaFilter, setContaFilter] = useState("all");
  const [categoriaFilter, setCategoriaFilter] = useState("all");
  const [fornecedorFilter, setFornecedorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Calcular datas de início e fim baseado no período selecionado
  const getDateRange = () => {
    if (customRange) {
      return {
        inicio: startOfDay(customRange.from),
        fim: endOfDay(customRange.to),
      };
    }

    return {
      inicio: startOfMonth(selectedMonth),
      fim: endOfMonth(selectedMonth),
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
        `
        )
        .eq("tipo", "saida")
        .eq("igreja_id", igrejaId)
        .gte("data_vencimento", dateRange.inicio.toISOString().split("T")[0])
        .lte("data_vencimento", dateRange.fim.toISOString().split("T")[0])
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
            t.solicitacao_reembolso?.status === "pago"
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

  // Aplicar filtros
  const transacoesFiltradas = useMemo(() => {
    if (!transacoes) return [];

    return transacoes.filter((t) => {
      // Filtro de busca por descrição
      if (busca && !t.descricao.toLowerCase().includes(busca.toLowerCase())) {
        return false;
      }

      // Filtro de conta
      if (contaFilter !== "all" && t.conta_id !== contaFilter) {
        return false;
      }

      // Filtro de categoria
      if (categoriaFilter !== "all" && t.categoria_id !== categoriaFilter) {
        return false;
      }

      // Filtro de fornecedor
      if (fornecedorFilter !== "all" && t.fornecedor_id !== fornecedorFilter) {
        return false;
      }

      // Filtro de status
      if (statusFilter !== "all" && t.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [
    transacoes,
    busca,
    contaFilter,
    categoriaFilter,
    fornecedorFilter,
    statusFilter,
  ]);

  const formatCurrency = (value: number) => {
    return formatValue(value);
  };

  const totalSaidas =
    transacoesFiltradas?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPago =
    transacoesFiltradas
      ?.filter((t) => t.status === "pago")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalPendente =
    transacoesFiltradas
      ?.filter((t) => t.status === "pendente")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;

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
      const vencimento = new Date(transacao.data_vencimento);
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
      const vencimento = new Date(transacao.data_vencimento);
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
            contas={contas || []}
            categorias={categorias || []}
            fornecedores={fornecedores || []}
            onLimpar={() => {
              setBusca("");
              setContaFilter("all");
              setCategoriaFilter("all");
              setFornecedorFilter("all");
              setStatusFilter("all");
              setSelectedMonth(new Date());
              setCustomRange(null);
            }}
            onAplicar={() => refetch()}
          />
          <Button variant="outline" onClick={handleExportar} size="sm">
            <Download className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline text-xs">Exportar</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setImportDialogOpen(true)}
            size="sm"
          >
            <Upload className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline text-xs">Importar</span>
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
                  "dd/MM/yyyy"
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
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
      </div>

      {/* Lista de Transações */}
      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl">Lista de Saídas</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Carregando...
            </p>
          ) : transacoesFiltradas && transacoesFiltradas.length > 0 ? (
            <div className="space-y-2">
              {transacoesFiltradas.map((transacao) => (
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
                      {format(new Date(transacao.data_vencimento), "dd", {
                        locale: ptBR,
                      })}
                    </div>
                    <div className="text-[10px] md:text-xs text-muted-foreground uppercase">
                      {format(new Date(transacao.data_vencimento), "MMM", {
                        locale: ptBR,
                      })}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="h-10 w-px bg-border" />

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm md:text-base truncate">
                      {transacao.descricao}
                    </h3>
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
                      <Badge
                        className={`text-[10px] md:text-xs ${getStatusColorDynamic(
                          transacao
                        )}`}
                      >
                        {getStatusDisplay(transacao)}
                      </Badge>
                    </div>
                    <TransacaoActionsMenu
                      transacaoId={transacao.id}
                      status={transacao.status}
                      tipo="saida"
                      isReembolso={!!transacao.solicitacao_reembolso_id}
                      onEdit={() => {
                        setEditingTransacao(transacao);
                        setDialogOpen(true);
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
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

      <ImportarExcelDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        tipo="saida"
      />
    </div>
  );
}
