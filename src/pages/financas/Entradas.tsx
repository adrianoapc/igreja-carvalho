import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  ArrowLeft,
  Calendar,
  TrendingUp,
  Building2,
  FileText,
  Upload,
  Paperclip,
  X,
  Download,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportToExcel,
  formatDateForExport,
  formatCurrencyForExport,
  formatBooleanForExport,
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

export default function Entradas() {
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
      "entradas",
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
          fornecedor:fornecedor_id(nome)
        `
        )
        .eq("tipo", "entrada")
        .eq("igreja_id", igrejaId)
        .gte("data_vencimento", dateRange.inicio.toISOString().split("T")[0])
        .lte("data_vencimento", dateRange.fim.toISOString().split("T")[0])
        .order("data_vencimento", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data;
    },
    enabled: !loading && !!igrejaId,
  });

  // Buscar contas e categorias para os filtros
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
    queryKey: ["categorias-filtro-entrada", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("ativo", true)
        .eq("tipo", "entrada")
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

      // Filtro de status
      if (statusFilter !== "all" && t.status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [transacoes, busca, contaFilter, categoriaFilter, statusFilter]);

  const formatCurrency = (value: number) => {
    return formatValue(value);
  };

  const totalEntradas =
    transacoesFiltradas?.reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const totalRecebido =
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
    if (transacao.status === "pago") return "Recebido";
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
        "Data Recebimento": formatDateForExport(t.data_pagamento),
        Conta: t.conta?.nome || "",
        Categoria: t.categoria?.nome || "",
        Subcategoria: t.subcategoria?.nome || "",
        "Base Ministerial": t.base_ministerial?.titulo || "",
        "Centro de Custo": t.centro_custo?.nome || "",
        "Forma Pagamento": t.forma_pagamento || "",
        Observações: t.observacoes || "",
      }));

      exportToExcel(dadosExportacao, "Entradas", "Entradas");
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
                Entradas
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-0.5">
                Gerencie os recebimentos da igreja
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
            status={statusFilter}
            setStatus={setStatusFilter}
            contas={contas || []}
            categorias={categorias || []}
            tipoTransacao="entrada"
            onLimpar={() => {
              setBusca("");
              setContaFilter("all");
              setCategoriaFilter("all");
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
            <span className="hidden sm:inline text-xs">Nova Entrada</span>
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
          {statusFilter !== "all" && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              Status:{" "}
              {statusFilter === "pendente"
                ? "Pendente"
                : statusFilter === "pago"
                ? "Recebido"
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
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">
                  {formatCurrency(totalEntradas)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Recebido</p>
                <p className="text-lg font-bold">
                  {formatCurrency(totalRecebido)}
                </p>
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
          <CardTitle className="text-lg md:text-xl">
            Lista de Entradas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Carregando...
            </p>
          ) : transacoesFiltradas && transacoesFiltradas.length > 0 ? (
            <>
              {/* Tabela Desktop */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs">Descrição</TableHead>
                      <TableHead className="text-xs">Conta</TableHead>
                      <TableHead className="text-xs">Categoria</TableHead>
                      <TableHead className="text-xs">Vencimento</TableHead>
                      <TableHead className="text-xs text-right">
                        Valor
                      </TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                      <TableHead className="text-xs text-center">
                        Ações
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transacoesFiltradas.map((transacao) => (
                      <TableRow
                        key={transacao.id}
                        className="hover:bg-muted/50"
                      >
                        <TableCell className="text-sm font-medium">
                          {transacao.descricao}
                        </TableCell>
                        <TableCell className="text-sm">
                          {transacao.conta?.nome || "-"}
                        </TableCell>
                        <TableCell className="text-sm">
                          {transacao.categoria ? (
                            <div className="flex items-center gap-1">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{
                                  backgroundColor:
                                    transacao.categoria.cor || "#666",
                                }}
                              />
                              <span>{transacao.categoria.nome}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(
                            new Date(transacao.data_vencimento),
                            "dd/MM/yyyy",
                            { locale: ptBR }
                          )}
                        </TableCell>
                        <TableCell className="text-sm font-semibold text-right text-green-600">
                          {formatCurrency(Number(transacao.valor))}
                        </TableCell>
                        <TableCell className="text-sm">
                          <Badge
                            className={`text-xs ${getStatusColorDynamic(
                              transacao
                            )}`}
                          >
                            {getStatusDisplay(transacao)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-center">
                          <TransacaoActionsMenu
                            transacaoId={transacao.id}
                            status={transacao.status}
                            tipo="entrada"
                            onEdit={() => {
                              setEditingTransacao(transacao);
                              setDialogOpen(true);
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Cards Mobile */}
              <div className="md:hidden space-y-2 p-4">
                {transacoesFiltradas.map((transacao) => (
                  <div
                    key={transacao.id}
                    className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Data Compact - Mobile */}
                    <div className="flex-shrink-0 text-center w-12">
                      <div className="text-xs font-bold text-foreground">
                        {format(new Date(transacao.data_vencimento), "dd", {
                          locale: ptBR,
                        })}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase">
                        {format(new Date(transacao.data_vencimento), "MMM", {
                          locale: ptBR,
                        })}
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="h-10 w-px bg-border" />

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-sm truncate">
                        {transacao.descricao}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
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
                        <p className="text-base font-bold text-green-600 whitespace-nowrap">
                          {formatCurrency(Number(transacao.valor))}
                        </p>
                        <Badge
                          className={`text-[10px] ${getStatusColorDynamic(
                            transacao
                          )}`}
                        >
                          {getStatusDisplay(transacao)}
                        </Badge>
                      </div>
                      <TransacaoActionsMenu
                        transacaoId={transacao.id}
                        status={transacao.status}
                        tipo="entrada"
                        onEdit={() => {
                          setEditingTransacao(transacao);
                          setDialogOpen(true);
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm md:text-base text-muted-foreground text-center py-4">
              Nenhuma entrada encontrada para o período selecionado.
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
        tipo="entrada"
        transacao={editingTransacao}
      />

      <ImportarExcelDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        tipo="entrada"
      />
    </div>
  );
}
