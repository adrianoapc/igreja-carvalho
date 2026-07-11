import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { callFinRpc } from "@/features/financeiro/core";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { useHideValues } from "@/hooks/useHideValues";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { useState } from "react";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = {
  Dinheiro: "#10b981",
  PIX: "#8b5cf6",
  "Cartão de Crédito": "#f59e0b",
  "Cartão de Débito": "#3b82f6",
  Boleto: "#ef4444",
  Transferência: "#06b6d4",
};

export default function DashboardOfertas() {
  const navigate = useNavigate();
  const { formatValue } = useHideValues();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: filialLoading,
  } = useAuthContext();

  const getDatasIntervalo = () => {
    if (customRange?.from && customRange?.to) {
      return {
        inicio: format(customRange.from, "yyyy-MM-dd"),
        fim: format(customRange.to, "yyyy-MM-dd"),
      };
    }

    return {
      inicio: format(startOfMonth(selectedMonth), "yyyy-MM-dd"),
      fim: format(endOfMonth(selectedMonth), "yyyy-MM-dd"),
    };
  };

  const datas = getDatasIntervalo();

  // Agregado no servidor (fin_ofertas_periodo, F2.5/ADR-029): filtro
  // ESTRUTURAL (sessao_id ou categoria de oferta/dízimo) no lugar do frágil
  // ilike em descricao; dia×forma×conta já somados — sem teto de 1000 linhas.
  const { data: ofertasAgregadas, isLoading } = useQuery({
    queryKey: [
      "ofertas-dashboard",
      datas.inicio,
      datas.fim,
      igrejaId,
      filialId,
      isAllFiliais,
    ],
    queryFn: async () => {
      const resultado = await callFinRpc("fin_ofertas_periodo", {
        p_inicio: datas.inicio,
        p_fim: datas.fim,
        p_filial_id: !isAllFiliais && filialId ? filialId : null,
      });
      return resultado as unknown as {
        dia: string;
        forma_pagamento_id: string | null;
        forma_nome: string;
        conta_nome: string;
        total: number;
        quantidade: number;
      }[];
    },
    enabled: !!igrejaId && !filialLoading,
  });

  // Buscar histórico de rejeições
  const { data: rejeicoes } = useQuery({
    queryKey: ["rejeicoes-oferta", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("notifications")
        .select("*, related_user_id")
        .eq("type", "rejeicao_oferta")
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;

      if (error) throw error;
      return data || [];
    },
    enabled: !!igrejaId && !filialLoading,
  });

  const processarDados = () => {
    if (!ofertasAgregadas || ofertasAgregadas.length === 0) {
      return {
        totalGeral: 0,
        porFormaPagamento: [],
        porConta: [],
        evolucaoMensal: [],
        comparativoMensal: [],
        tendencia: { valor: 0, percentual: 0 },
      };
    }

    // Total geral
    const totalGeral = ofertasAgregadas.reduce(
      (acc, t) => acc + Number(t.total),
      0,
    );

    // Por forma de pagamento
    const porForma: Record<string, number> = {};
    ofertasAgregadas.forEach((t) => {
      porForma[t.forma_nome] = (porForma[t.forma_nome] || 0) + Number(t.total);
    });

    const porFormaPagamento = Object.entries(porForma).map(([name, value]) => ({
      name,
      value,
    }));

    // Por conta
    const porContaMap: Record<string, number> = {};
    ofertasAgregadas.forEach((t) => {
      porContaMap[t.conta_nome] =
        (porContaMap[t.conta_nome] || 0) + Number(t.total);
    });

    const porConta = Object.entries(porContaMap).map(([name, value]) => ({
      name,
      value,
    }));

    // Evolução temporal - agrupado por dia
    const evolucaoMap: Record<string, Record<string, number>> = {};

    ofertasAgregadas.forEach((t) => {
      const chave = format(parseISO(t.dia), "dd/MM", { locale: ptBR });

      if (!evolucaoMap[chave]) {
        evolucaoMap[chave] = {};
      }

      evolucaoMap[chave][t.forma_nome] =
        (evolucaoMap[chave][t.forma_nome] || 0) + Number(t.total);
    });

    const evolucaoMensal = Object.entries(evolucaoMap)
      .sort((a, b) => {
        const [diaA, mesA] = a[0].split("/").map(Number);
        const [diaB, mesB] = b[0].split("/").map(Number);
        return (mesA || 0) - (mesB || 0) || (diaA || 0) - (diaB || 0);
      })
      .map(([chave, formas]) => ({
        mes: chave,
        ...formas,
        total: Object.values(formas).reduce((acc, v) => acc + v, 0),
      }));

    // Comparativo mensal (total por mês)
    const comparativoMensal = evolucaoMensal.map(({ mes, total }) => ({
      mes,
      valor: total,
    }));

    // Tendência (comparação últimos 2 meses)
    if (comparativoMensal.length >= 2) {
      const mesAtual = comparativoMensal[comparativoMensal.length - 1].valor;
      const mesAnterior = comparativoMensal[comparativoMensal.length - 2].valor;
      const diferenca = mesAtual - mesAnterior;
      const percentual = mesAnterior > 0 ? (diferenca / mesAnterior) * 100 : 0;

      return {
        totalGeral,
        porFormaPagamento,
        porConta,
        evolucaoMensal,
        comparativoMensal,
        tendencia: { valor: diferenca, percentual },
      };
    }

    return {
      totalGeral,
      porFormaPagamento,
      porConta,
      evolucaoMensal,
      comparativoMensal,
      tendencia: { valor: 0, percentual: 0 },
    };
  };

  const dados = processarDados();

  if (isLoading) {
    return (
      <div className="container mx-auto p-4 space-y-6">
        <Skeleton className="h-12 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const formasPagamento = Array.from(
    new Set(ofertasAgregadas?.map((t) => t.forma_nome) || []),
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="space-y-4 mb-6">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate("/financas")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Dashboard de Ofertas</h1>
            <p className="text-sm text-muted-foreground">
              Análise detalhada das ofertas por forma de pagamento
            </p>
          </div>
          <div className="flex items-center gap-2">
            <HideValuesToggle />
            <MonthPicker
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
          </div>
        </div>

        {/* Period Badge */}
        <div className="flex flex-wrap gap-2">
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

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total de Ofertas
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatValue(dados.totalGeral)}
            </div>
            <p className="text-xs text-muted-foreground">
              {ofertasAgregadas?.reduce(
                (acc, t) => acc + Number(t.quantidade),
                0,
              ) || 0}{" "}
              registros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendência</CardTitle>
            {dados.tendencia.valor >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                dados.tendencia.valor >= 0 ? "text-green-500" : "text-red-500"
              }`}
            >
              {dados.tendencia.percentual >= 0 ? "+" : ""}
              {dados.tendencia.percentual.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {dados.tendencia.valor >= 0 ? "Crescimento" : "Redução"} no
              período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Formas de Pagamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.porFormaPagamento.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Métodos utilizados nas ofertas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Contas Utilizadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dados.porConta.length}</div>
            <p className="text-xs text-muted-foreground">
              Contas que receberam ofertas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Histórico de Rejeições */}
      {rejeicoes && rejeicoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-destructive">
              Histórico de Conferências Rejeitadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {rejeicoes.map((rejeicao) => {
                type RejeicaoMeta = {
                  data_evento?: string;
                  lancado_por?: string;
                  conferente?: string;
                  total?: number;
                  valores?: string;
                } | null;
                const metadata = rejeicao.metadata as RejeicaoMeta;
                return (
                  <div
                    key={rejeicao.id}
                    className="p-3 border rounded-lg bg-destructive/5 border-destructive/20"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <p className="font-medium text-sm">
                          {metadata?.data_evento}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Lançado por: {metadata?.lancado_por}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Conferente: {metadata?.conferente}
                        </p>
                        <p className="text-sm font-semibold mt-2">
                          Total: {formatValue(metadata?.total || 0)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {metadata?.valores}
                        </p>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rejeicao.created_at &&
                          format(
                            parseISO(rejeicao.created_at),
                            "dd/MM/yyyy HH:mm",
                            {
                              locale: ptBR,
                            }
                          )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribuição por Forma de Pagamento */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dados.porFormaPagamento}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) =>
                    `${name}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {dados.porFormaPagamento.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        COLORS[entry.name as keyof typeof COLORS] || "#6b7280"
                      }
                    />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatValue(value)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolução Temporal */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução no Período</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dados.evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip formatter={(value: number) => formatValue(value)} />
                <Legend />
                {formasPagamento.map((forma) => (
                  <Line
                    key={forma}
                    type="monotone"
                    dataKey={forma}
                    stroke={COLORS[forma as keyof typeof COLORS] || "#6b7280"}
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento por Forma de Pagamento */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento por Forma de Pagamento</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={dados.evolucaoMensal}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip formatter={(value: number) => formatValue(value)} />
              <Legend />
              {formasPagamento.map((forma) => (
                <Bar
                  key={forma}
                  dataKey={forma}
                  stackId="a"
                  fill={COLORS[forma as keyof typeof COLORS] || "#6b7280"}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Resumo por Conta */}
      <Card>
        <CardHeader>
          <CardTitle>Resumo por Conta Financeira</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {dados.porConta.map((conta, index) => {
              const percentual = (conta.value / dados.totalGeral) * 100;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{conta.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="h-2 flex-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full transition-all"
                          style={{
                            width: `${percentual}%`,
                            backgroundColor:
                              Object.values(COLORS)[
                                index % Object.values(COLORS).length
                              ],
                          }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-12 text-right">
                        {percentual.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 text-right">
                    <p className="text-lg font-bold">
                      {formatValue(conta.value)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
