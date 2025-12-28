import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, TrendingDown, Calendar, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { addMonths, format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { useHideValues } from "@/hooks/useHideValues";

export default function Projecao() {
  const navigate = useNavigate();
  const { formatValue } = useHideValues();

  // Buscar transações dos últimos 12 meses para análise
  const { data: historicoTransacoes } = useQuery({
    queryKey: ['historico-transacoes-12meses'],
    queryFn: async () => {
      const dataInicio = subMonths(new Date(), 12);
      
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select('*')
        .eq('status', 'pago')
        .gte('data_pagamento', dataInicio.toISOString().split('T')[0])
        .order('data_pagamento');
      
      if (error) throw error;
      return data;
    },
  });

  // Buscar transações futuras (pendentes)
  const { data: transacoesFuturas } = useQuery({
    queryKey: ['transacoes-futuras'],
    queryFn: async () => {
      const hoje = new Date();
      
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select('*')
        .eq('status', 'pendente')
        .gte('data_vencimento', hoje.toISOString().split('T')[0])
        .order('data_vencimento');
      
      if (error) throw error;
      return data;
    },
  });

  const formatCurrency = (value: number) => formatValue(value);

  // Calcular médias mensais baseadas no histórico
  const calcularMediasMensais = () => {
    if (!historicoTransacoes || historicoTransacoes.length === 0) {
      return { mediaEntradas: 0, mediaSaidas: 0 };
    }

    const mesesUnicos = new Set<string>();
    let totalEntradas = 0;
    let totalSaidas = 0;

    historicoTransacoes.forEach(t => {
      const mesAno = format(new Date(t.data_pagamento!), 'yyyy-MM');
      mesesUnicos.add(mesAno);
      
      if (t.tipo === 'entrada') {
        totalEntradas += Number(t.valor);
      } else {
        totalSaidas += Number(t.valor);
      }
    });

    const numMeses = mesesUnicos.size || 1;

    return {
      mediaEntradas: totalEntradas / numMeses,
      mediaSaidas: totalSaidas / numMeses,
    };
  };

  const { mediaEntradas, mediaSaidas } = calcularMediasMensais();

  // Projetar próximos 6 meses
  const gerarProjecao = () => {
    const projecao = [];
    const hoje = new Date();

    for (let i = 0; i < 6; i++) {
      const mes = addMonths(hoje, i);
      const mesAno = format(mes, 'MMM/yy', { locale: ptBR });
      const inicioMes = startOfMonth(mes);
      const fimMes = endOfMonth(mes);

      // Transações confirmadas para este mês
      const transacoesMes = transacoesFuturas?.filter(t => {
        const dataVenc = new Date(t.data_vencimento);
        return dataVenc >= inicioMes && dataVenc <= fimMes;
      }) || [];

      const entradasConfirmadas = transacoesMes
        .filter(t => t.tipo === 'entrada')
        .reduce((sum, t) => sum + Number(t.valor), 0);

      const saidasConfirmadas = transacoesMes
        .filter(t => t.tipo === 'saida')
        .reduce((sum, t) => sum + Number(t.valor), 0);

      // Projeção baseada em médias históricas + confirmadas
      const entradasProjetadas = i === 0 ? entradasConfirmadas : mediaEntradas + entradasConfirmadas;
      const saidasProjetadas = i === 0 ? saidasConfirmadas : mediaSaidas + saidasConfirmadas;

      projecao.push({
        mes: mesAno,
        Entradas: entradasProjetadas,
        Saidas: saidasProjetadas,
        Saldo: entradasProjetadas - saidasProjetadas,
        tipo: i === 0 ? 'atual' : 'projecao',
      });
    }

    return projecao;
  };

  const projecao = gerarProjecao();

  // Calcular saldo acumulado projetado
  const saldoAcumuladoProjetado = () => {
    let saldoAcumulado = 0;
    return projecao.map(p => {
      saldoAcumulado += p.Saldo;
      return {
        mes: p.mes,
        SaldoAcumulado: saldoAcumulado,
        tipo: p.tipo,
      };
    });
  };

  const dadosSaldoAcumulado = saldoAcumuladoProjetado();

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/financas')}
          className="w-fit"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <div className="flex items-center gap-2">
          <HideValuesToggle />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Projeção Financeira</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Análise preditiva baseada em histórico e transações agendadas
          </p>
        </div>
      </div>

      {/* Médias Históricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Média Mensal de Entradas</p>
                <p className="text-lg font-bold">{formatCurrency(mediaEntradas)}</p>
                <p className="text-xs text-muted-foreground">Baseado em 12 meses</p>
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
                <p className="text-xs text-muted-foreground">Média Mensal de Saídas</p>
                <p className="text-lg font-bold">{formatCurrency(mediaSaidas)}</p>
                <p className="text-xs text-muted-foreground">Baseado em 12 meses</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Saldo Médio Mensal</p>
                <p className={`text-lg font-bold ${mediaEntradas - mediaSaidas >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(mediaEntradas - mediaSaidas)}
                </p>
                <p className="text-xs text-muted-foreground">Tendência histórica</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Projeção */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Projeção para os Próximos 6 Meses
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={projecao}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              />
              <Legend />
              <Bar dataKey="Entradas" fill="#10b981" />
              <Bar dataKey="Saidas" fill="#ef4444" />
              <Bar dataKey="Saldo" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Saldo Acumulado Projetado */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Fluxo de Caixa Projetado (Acumulado)</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dadosSaldoAcumulado}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis tickFormatter={(value) => formatCurrency(value)} />
              <Tooltip 
                formatter={(value: number) => formatCurrency(value)}
                contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="SaldoAcumulado" 
                stroke="#8b5cf6" 
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Detalhamento da Projeção */}
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {projecao.map((item, idx) => (
              <div key={idx} className="p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold">{item.mes}</h4>
                  {item.tipo === 'atual' && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">Mês Atual</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Entradas</p>
                    <p className="font-semibold text-green-600">{formatCurrency(item.Entradas)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Saídas</p>
                    <p className="font-semibold text-red-600">{formatCurrency(item.Saidas)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Saldo</p>
                    <p className={`font-semibold ${item.Saldo >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                      {formatCurrency(item.Saldo)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
