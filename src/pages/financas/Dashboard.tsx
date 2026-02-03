import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart,
  Calendar,
  ReceiptText,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  startOfMonth,
  endOfMonth,
  format,
  subMonths,
  addDays,
  startOfDay,
  parseISO,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatLocalDate, startOfMonthLocal, endOfMonthLocal } from "@/utils/dateUtils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart as RechartsePieChart,
  Pie,
  Cell,
} from "recharts";
import { FiltrosSheet } from "@/components/financas/FiltrosSheet";
import { ContasAPagarWidget } from "@/components/financas/ContasAPagarWidget";
import { useState } from "react";
import { useHideValues } from "@/hooks/useHideValues";
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { useQueryClient } from "@tanstack/react-query";

export default function Dashboard() {
  const navigate = useNavigate();
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();
  const queryClient = useQueryClient();

  // MonthPicker states
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [contaId, setContaId] = useState("all");
  const [categoriaId, setCategoriaId] = useState("all");
  const [status, setStatus] = useState("all");

  const mesAtual = new Date();
  const mesAnterior = subMonths(mesAtual, 1);

  // Calcular range de datas baseado no período
  const getDateRange = () => {
    if (customRange) {
      return {
        inicio: formatLocalDate(customRange.from),
        fim: formatLocalDate(customRange.to),
      };
    }

    return {
      inicio: formatLocalDate(startOfMonthLocal(selectedMonth)),
      fim: formatLocalDate(endOfMonthLocal(selectedMonth)),
    };
  };

  const dateRange = getDateRange();

  // Buscar contas e categorias para filtros
  const { data: contas } = useQuery({
    queryKey: ["contas-filtro", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("*")
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
    queryKey: ["categorias-filtro", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("categorias_financeiras")
        .select("*")
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

  // Dados do período filtrado
  const { data: transacoesMesAtual } = useQuery({
    queryKey: [
      "dashboard-mes-atual",
      igrejaId,
      filialId,
      isAllFiliais,
      dateRange,
      contaId,
      categoriaId,
      status,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          `
          *,
          categoria:categoria_id(nome, cor),
          solicitacao_reembolso:solicitacao_reembolso_id(status)
        `
        )
        .eq("igreja_id", igrejaId)
        .gte("data_vencimento", dateRange.inicio)
        .lte("data_vencimento", dateRange.fim);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      if (contaId !== "all") {
        query = query.eq("conta_id", contaId);
      }
      if (categoriaId !== "all") {
        query = query.eq("categoria_id", categoriaId);
      }
      if (status !== "all") {
        query = query.eq("status", status);
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

  // Dados do mês anterior
  const { data: transacoesMesAnterior } = useQuery({
    queryKey: ["dashboard-mes-anterior", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          `
          *,
          solicitacao_reembolso:solicitacao_reembolso_id(status)
        `
        )
        .eq("igreja_id", igrejaId)
        .gte(
          "data_vencimento",
          formatLocalDate(startOfMonthLocal(mesAnterior))
        )
        .lte(
          "data_vencimento",
          formatLocalDate(endOfMonthLocal(mesAnterior))
        );
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

  // Pendências críticas da semana
  const hoje = startOfDay(new Date());
  const fimSemana = addDays(hoje, 7);

  const { data: pendenciasSemana = [] } = useQuery({
    queryKey: ["dashboard-contas-semana", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          `
          id, valor, data_vencimento, solicitacao_reembolso_id,
          solicitacao_reembolso:solicitacao_reembolso_id(status)
        `
        )
        .eq("tipo", "saida")
        .eq("status", "pendente")
        .eq("igreja_id", igrejaId)
        .lte("data_vencimento", format(fimSemana, "yyyy-MM-dd"));
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;

      // Filtrar: exclui transações de reembolso que NÃO estão pagas
      return (data || []).filter(
        (t) =>
          !t.solicitacao_reembolso_id ||
          t.solicitacao_reembolso?.status === "pago"
      );
    },
    enabled: !loading && !!igrejaId,
  });

  const vencidasSemana = pendenciasSemana.filter(
    (item) => parseISO(item.data_vencimento) < hoje
  );
  const totalSemana = pendenciasSemana.reduce(
    (sum, item) => sum + Number(item.valor || 0),
    0
  );
  const mostrarAlertaSemana = pendenciasSemana.length > 0;

  const formatCurrency = (value: number) => {
    return formatValue(value);
  };

  type ReembolsoView = {
    id: string;
    status: string;
    created_at: string;
    filial_id?: string | null;
    igreja_id: string;
    valor_total?: number;
  };

  // Reembolsos em aberto (pendente/aprovado)
  const { data: reembolsosAbertos = [] } = useQuery({
    queryKey: [
      "reembolsos-abertos",
      igrejaId,
      filialId,
      isAllFiliais,
      dateRange,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase as any)
        .from("view_solicitacoes_reembolso")
        .select("id, status, created_at, filial_id, igreja_id, valor_total")
        .in("status", ["pendente", "aprovado"]) // aguardando pagamento
        .eq("igreja_id", igrejaId)
        .gte("created_at", dateRange.inicio)
        .lte("created_at", dateRange.fim)
        .order("created_at", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !loading && !!igrejaId,
  });

  // Relatórios de oferta (solicitações de conferência no período)
  const { data: relatoriosOferta = [] } = useQuery({
    queryKey: [
      "relatorios-oferta",
      igrejaId,
      filialId,
      isAllFiliais,
      dateRange,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("notifications")
        .select("id, created_at")
        .eq("type", "conferencia_oferta")
        .eq("igreja_id", igrejaId)
        .gte("created_at", dateRange.inicio)
        .lte("created_at", dateRange.fim)
        .order("created_at", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !loading && !!igrejaId,
  });

  // Sessões de contagem recentes (últimos 60 dias)
  type Sessao = {
    id: string;
    status: string;
    created_at: string;
    filial_id?: string | null;
    igreja_id: string;
  };
  const { data: sessoesRecentes = [] } = useQuery<Sessao[]>({
    queryKey: ["sessoes-contagem-resumo", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("sessoes_contagem")
        .select("id, status, created_at, filial_id, igreja_id")
        .eq("igreja_id", igrejaId)
        .gte("created_at", format(addDays(new Date(), -60), "yyyy-MM-dd"))
        .order("created_at", { ascending: false });
      if (!isAllFiliais && filialId) query = query.eq("filial_id", filialId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as Sessao[];
    },
    enabled: !loading && !!igrejaId,
  });

  const totalAbertas = sessoesRecentes.filter((s) =>
    ["aberta", "em_contagem"].includes(s.status)
  ).length;
  const totalDivergentes = sessoesRecentes.filter(
    (s) => s.status === "divergente"
  ).length;
  const totalValidadas = sessoesRecentes.filter(
    (s) => s.status === "validada"
  ).length;

  // Cálculos do mês atual
  const receitasMesAtual =
    transacoesMesAtual
      ?.filter((t) => t.tipo === "entrada")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const despesasMesAtual =
    transacoesMesAtual
      ?.filter((t) => t.tipo === "saida")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const saldoMesAtual = receitasMesAtual - despesasMesAtual;

  // Cálculos do mês anterior
  const receitasMesAnterior =
    transacoesMesAnterior
      ?.filter((t) => t.tipo === "entrada")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;
  const despesasMesAnterior =
    transacoesMesAnterior
      ?.filter((t) => t.tipo === "saida")
      .reduce((sum, t) => sum + Number(t.valor), 0) || 0;

  // Variações percentuais
  const variacaoReceitas =
    receitasMesAnterior > 0
      ? ((receitasMesAtual - receitasMesAnterior) / receitasMesAnterior) * 100
      : 0;
  const variacaoDespesas =
    despesasMesAnterior > 0
      ? ((despesasMesAtual - despesasMesAnterior) / despesasMesAnterior) * 100
      : 0;

  // Dados para gráfico comparativo
  const dadosComparativos = [
    {
      mes: format(mesAnterior, "MMM/yy", { locale: ptBR }),
      Receitas: receitasMesAnterior,
      Despesas: despesasMesAnterior,
    },
    {
      mes: format(mesAtual, "MMM/yy", { locale: ptBR }),
      Receitas: receitasMesAtual,
      Despesas: despesasMesAtual,
    },
  ];

  // Agrupar por categoria (top 5)
  const categoriaMap = new Map();
  transacoesMesAtual?.forEach((t) => {
    if (t.categoria) {
      const nome = t.categoria.nome;
      const atual = categoriaMap.get(nome) || {
        nome,
        valor: 0,
        cor: t.categoria.cor,
      };
      categoriaMap.set(nome, {
        ...atual,
        valor: atual.valor + Number(t.valor),
      });
    }
  });

  const dadosCategorias = Array.from(categoriaMap.values())
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/financas")}
          className="w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Dashboard Financeiro
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Visualize indicadores e análises financeiras
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HideValuesToggle />
            <FiltrosSheet
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
              busca=""
              setBusca={() => {}}
              contaId={contaId}
              setContaId={setContaId}
              categoriaId={categoriaId}
              setCategoriaId={setCategoriaId}
              status={status}
              setStatus={setStatus}
              contas={contas || []}
              categorias={categorias || []}
              onLimpar={() => {
                setSelectedMonth(new Date());
                setCustomRange(null);
                setContaId("all");
                setCategoriaId("all");
                setStatus("all");
              }}
              onAplicar={() => {}}
            />
          </div>
        </div>

        {/* Period Badge */}
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
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">
        <div className="space-y-3 lg:col-span-3">
          {mostrarAlertaSemana && (
            <Card
              className={`shadow-soft ${
                vencidasSemana.length
                  ? "bg-destructive/10 border-destructive/30"
                  : ""
              }`}
            >
              <CardContent className="p-4">
                <p className="text-sm font-medium">
                  Você tem{" "}
                  <span className="font-semibold">
                    {pendenciasSemana.length}
                  </span>{" "}
                  contas vencendo esta semana, totalizando{" "}
                  <span className="font-semibold">
                    {formatCurrency(totalSemana)}
                  </span>
                  .
                </p>
                {vencidasSemana.length > 0 && (
                  <p className="text-xs text-destructive mt-1">
                    Existem contas vencidas. Priorize o pagamento hoje.
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Cards de Resumo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">
                      Receitas {format(mesAtual, "MMM/yy", { locale: ptBR })}
                    </p>
                    <p className="text-lg font-bold">
                      {formatCurrency(receitasMesAtual)}
                    </p>
                    {variacaoReceitas !== 0 && (
                      <p
                        className={`text-xs ${
                          variacaoReceitas > 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {variacaoReceitas > 0 ? "+" : ""}
                        {variacaoReceitas.toFixed(1)}% vs mês anterior
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">
                      Despesas {format(mesAtual, "MMM/yy", { locale: ptBR })}
                    </p>
                    <p className="text-lg font-bold">
                      {formatCurrency(despesasMesAtual)}
                    </p>
                    {variacaoDespesas !== 0 && (
                      <p
                        className={`text-xs ${
                          variacaoDespesas > 0
                            ? "text-red-600"
                            : "text-green-600"
                        }`}
                      >
                        {variacaoDespesas > 0 ? "+" : ""}
                        {variacaoDespesas.toFixed(1)}% vs mês anterior
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card
              className="shadow-soft hover:shadow-md transition-all cursor-pointer"
              onClick={() => navigate("/financas/contas")}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      saldoMesAtual >= 0
                        ? "bg-blue-100 dark:bg-blue-900/20"
                        : "bg-orange-100 dark:bg-orange-900/20"
                    }`}
                  >
                    <DollarSign
                      className={`w-5 h-5 ${
                        saldoMesAtual >= 0 ? "text-blue-600" : "text-orange-600"
                      }`}
                    />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">
                      Saldo {format(mesAtual, "MMM/yy", { locale: ptBR })}
                    </p>
                    <p
                      className={`text-lg font-bold ${
                        saldoMesAtual >= 0 ? "text-blue-600" : "text-orange-600"
                      }`}
                    >
                      {formatCurrency(saldoMesAtual)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {saldoMesAtual >= 0 ? "Superávit" : "Déficit"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Indicadores Operacionais */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mt-2">
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/20 flex items-center justify-center">
                      <Calendar className="w-5 h-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Sessões de Contagem
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Últimos 60 dias
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/financas/sessoes-contagem")}
                  >
                    Ver sessões
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Abertas</p>
                    <p className="text-lg font-bold">{totalAbertas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Divergentes</p>
                    <p className="text-lg font-bold text-destructive">
                      {totalDivergentes}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Validadas</p>
                    <p className="text-lg font-bold text-green-600">
                      {totalValidadas}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                    <ReceiptText className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">Reembolsos</p>
                    <p className="text-lg font-bold">
                      {reembolsosAbertos.length} solicitações
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Montante:{" "}
                      {new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: "BRL",
                      }).format(
                        reembolsosAbertos.reduce(
                          (sum, r) => sum + (r.valor_total || 0),
                          0
                        )
                      )}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">
                      Relatório de Ofertas
                    </p>
                    <p className="text-lg font-bold">
                      {relatoriosOferta.length} no período
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Envios e conferências recentes
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Card de Contas a Pagar - Centralizado */}
      <div className="w-full">
        <ContasAPagarWidget />
      </div>

      {/* Gráfico Comparativo */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Comparativo Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={dadosComparativos}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                }}
              />
              <Legend />
              <Bar dataKey="Receitas" fill="#10b981" />
              <Bar dataKey="Despesas" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top Categorias */}
      {dadosCategorias.length > 0 && (
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Top 5 Categorias -{" "}
              {format(mesAtual, "MMMM/yyyy", { locale: ptBR })}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={250}>
                <RechartsePieChart>
                  <Pie
                    data={dadosCategorias}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) =>
                      `${entry.nome}: ${formatCurrency(entry.valor)}`
                    }
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="valor"
                  >
                    {dadosCategorias.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.cor || COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{
                      backgroundColor: "hsl(var(--background))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                </RechartsePieChart>
              </ResponsiveContainer>

              <div className="space-y-3">
                {dadosCategorias.map((cat, idx) => (
                  <div key={cat.nome} className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full flex-shrink-0"
                      style={{
                        backgroundColor: cat.cor || COLORS[idx % COLORS.length],
                      }}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{cat.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(cat.valor)}
                      </p>
                    </div>
                    <p className="text-sm font-semibold">
                      {(
                        (cat.valor / (receitasMesAtual + despesasMesAtual)) *
                        100
                      ).toFixed(1)}
                      %
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
