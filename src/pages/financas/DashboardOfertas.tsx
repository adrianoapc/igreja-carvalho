import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

const COLORS = {
  "Dinheiro": "#10b981",
  "PIX": "#8b5cf6",
  "Cartão de Crédito": "#f59e0b",
  "Cartão de Débito": "#3b82f6",
  "Boleto": "#ef4444",
  "Transferência": "#06b6d4",
};

export default function DashboardOfertas() {
  const navigate = useNavigate();

  const { data: transacoes, isLoading } = useQuery({
    queryKey: ["ofertas-dashboard"],
    queryFn: async () => {
      const { data: categorias } = await supabase
        .from("categorias_financeiras")
        .select("id")
        .eq("nome", "Oferta")
        .eq("tipo", "entrada")
        .maybeSingle();

      if (!categorias) return [];

      const { data, error } = await supabase
        .from("transacoes_financeiras")
        .select("*")
        .eq("tipo", "entrada")
        .eq("categoria_id", categorias.id)
        .order("data_vencimento", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  const processarDados = () => {
    if (!transacoes || transacoes.length === 0) {
      return {
        totalGeral: 0,
        porFormaPagamento: [],
        evolucaoMensal: [],
        comparativoMensal: [],
        tendencia: { valor: 0, percentual: 0 },
      };
    }

    // Total geral
    const totalGeral = transacoes.reduce((acc, t) => acc + Number(t.valor), 0);

    // Por forma de pagamento
    const porForma: Record<string, number> = {};
    transacoes.forEach((t) => {
      const forma = t.forma_pagamento || "Não especificado";
      porForma[forma] = (porForma[forma] || 0) + Number(t.valor);
    });

    const porFormaPagamento = Object.entries(porForma).map(([name, value]) => ({
      name,
      value,
    }));

    // Evolução mensal (últimos 6 meses)
    const mesesMap: Record<string, Record<string, number>> = {};
    const hoje = new Date();

    for (let i = 5; i >= 0; i--) {
      const mes = subMonths(hoje, i);
      const mesKey = format(mes, "MMM/yy", { locale: ptBR });
      mesesMap[mesKey] = {};
    }

    transacoes.forEach((t) => {
      const data = parseISO(t.data_vencimento);
      const mesKey = format(data, "MMM/yy", { locale: ptBR });
      
      if (mesesMap[mesKey]) {
        const forma = t.forma_pagamento || "Não especificado";
        mesesMap[mesKey][forma] = (mesesMap[mesKey][forma] || 0) + Number(t.valor);
      }
    });

    const evolucaoMensal = Object.entries(mesesMap).map(([mes, formas]) => ({
      mes,
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
        evolucaoMensal,
        comparativoMensal,
        tendencia: { valor: diferenca, percentual },
      };
    }

    return {
      totalGeral,
      porFormaPagamento,
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
    new Set(transacoes?.map((t) => t.forma_pagamento || "Não especificado") || [])
  );

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" size="icon" onClick={() => navigate("/financas")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Ofertas</h1>
          <p className="text-sm text-muted-foreground">
            Análise detalhada das ofertas por forma de pagamento
          </p>
        </div>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ofertas</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dados.totalGeral.toLocaleString("pt-BR", {
                style: "currency",
                currency: "BRL",
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {transacoes?.length || 0} registros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tendência Mensal</CardTitle>
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
              {dados.tendencia.valor >= 0 ? "Crescimento" : "Redução"} em relação ao mês
              anterior
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Formas de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dados.porFormaPagamento.length}</div>
            <p className="text-xs text-muted-foreground">
              Métodos utilizados nas ofertas
            </p>
          </CardContent>
        </Card>
      </div>

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
                      fill={COLORS[entry.name as keyof typeof COLORS] || "#6b7280"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) =>
                    value.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  }
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolução Mensal */}
        <Card>
          <CardHeader>
            <CardTitle>Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dados.comparativoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) =>
                    value.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  }
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="valor"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  name="Total"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Evolução por Forma de Pagamento */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução por Forma de Pagamento</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={dados.evolucaoMensal}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="mes" />
                <YAxis />
                <Tooltip
                  formatter={(value: number) =>
                    value.toLocaleString("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    })
                  }
                />
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
      </div>
    </div>
  );
}
