import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { TrendingUp, TrendingDown, AlertTriangle, Award, Loader2, Calendar } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { HideValuesToggle } from "@/components/financas/HideValuesToggle";
import { useHideValues } from "@/hooks/useHideValues";

const COLORS = ['#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#3B82F6', '#EF4444'];

export default function Insights() {
  const [periodo, setPeriodo] = useState<"3" | "6" | "12">("6");
  const { formatValue } = useHideValues();

  // Calcular data inicial baseada no período selecionado
  const dataInicial = startOfMonth(subMonths(new Date(), parseInt(periodo)));
  const dataFinal = endOfMonth(new Date());

  // Buscar todas as transações do período
  const { data: transacoes, isLoading } = useQuery({
    queryKey: ['insights-transacoes', periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transacoes_financeiras')
        .select(`
          *,
          fornecedor:fornecedores(nome),
          categoria:categorias_financeiras(nome, cor),
          conta:contas(nome)
        `)
        .eq('tipo', 'saida')
        .gte('data_vencimento', dataInicial.toISOString())
        .lte('data_vencimento', dataFinal.toISOString())
        .order('data_vencimento', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Processar dados para insights
  const insights = transacoes ? processarInsights(transacoes) : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!insights) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
        <p>Nenhum dado disponível para análise</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Insights Financeiros</h1>
          <p className="text-muted-foreground">Análise de padrões e anomalias</p>
        </div>
        
        <div className="flex items-center gap-2">
          <HideValuesToggle />
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <Select value={periodo} onValueChange={(v) => setPeriodo(v as "3" | "6" | "12")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Últimos 3 meses</SelectItem>
              <SelectItem value="6">Últimos 6 meses</SelectItem>
              <SelectItem value="12">Último ano</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de resumo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Gasto</CardDescription>
            <CardTitle className="text-2xl">
              {formatValue(insights.totalGasto)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Média Mensal</CardDescription>
            <CardTitle className="text-2xl">
              {formatValue(insights.mediaMensal)}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Fornecedores Ativos</CardDescription>
            <CardTitle className="text-2xl">{insights.totalFornecedores}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Anomalias Detectadas</CardDescription>
            <CardTitle className="text-2xl text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {insights.anomalias.length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Tabs com análises */}
      <Tabs defaultValue="fornecedores" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="tendencias">Tendências</TabsTrigger>
          <TabsTrigger value="anomalias">Anomalias</TabsTrigger>
        </TabsList>

        {/* Tab Fornecedores */}
        <TabsContent value="fornecedores" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Fornecedores</CardTitle>
                <CardDescription>Maiores gastos do período</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={insights.topFornecedores.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="nome" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <Tooltip formatter={(value: number) => formatValue(value)} />
                    <Bar dataKey="total" fill="#8B5CF6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Frequência de Transações</CardTitle>
                <CardDescription>Fornecedores mais recorrentes</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.frequenciaFornecedores.slice(0, 8).map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium truncate max-w-[200px]">{item.nome}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{item.transacoes} transações</span>
                        <span className="text-sm font-semibold">
                          {formatValue(item.media)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Categorias */}
        <TabsContent value="categorias" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Distribuição por Categoria</CardTitle>
                <CardDescription>Percentual de gastos</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <PieChart>
                    <Pie
                      data={insights.categorias}
                      dataKey="total"
                      nameKey="nome"
                      cx="50%"
                      cy="50%"
                      outerRadius={120}
                      label={(entry) => `${entry.nome}: ${((entry.total / insights.totalGasto) * 100).toFixed(1)}%`}
                    >
                      {insights.categorias.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatValue(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Categorias</CardTitle>
                <CardDescription>Valores absolutos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {insights.categorias.map((cat, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{cat.nome}</span>
                        <span className="font-semibold">
                          {formatValue(cat.total)}
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(cat.total / insights.totalGasto) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{cat.transacoes} transações</span>
                        <span>{((cat.total / insights.totalGasto) * 100).toFixed(1)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Tendências */}
        <TabsContent value="tendencias" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evolução Mensal de Gastos</CardTitle>
              <CardDescription>Tendência ao longo do período</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={insights.gastosMensais}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatValue(value)} />
                  <Legend />
                  <Line type="monotone" dataKey="total" stroke="#8B5CF6" strokeWidth={2} name="Total" />
                  <Line type="monotone" dataKey="media" stroke="#EC4899" strokeWidth={2} strokeDasharray="5 5" name="Média" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardDescription>Tendência Geral</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  {insights.tendencia > 0 ? (
                    <>
                      <TrendingUp className="w-8 h-8 text-destructive" />
                      <div>
                        <p className="text-2xl font-bold text-destructive">+{insights.tendencia.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">Aumento no período</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="w-8 h-8 text-green-600" />
                      <div>
                        <p className="text-2xl font-bold text-green-600">{insights.tendencia.toFixed(1)}%</p>
                        <p className="text-sm text-muted-foreground">Redução no período</p>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Mês com Maior Gasto</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{insights.mesMaiorGasto?.mes}</p>
                <p className="text-2xl font-bold text-primary">
                  {insights.mesMaiorGasto ? formatValue(insights.mesMaiorGasto.total) : '-'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardDescription>Mês com Menor Gasto</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold">{insights.mesMenorGasto?.mes}</p>
                <p className="text-2xl font-bold text-green-600">
                  {insights.mesMenorGasto ? formatValue(insights.mesMenorGasto.total) : '-'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Tab Anomalias */}
        <TabsContent value="anomalias" className="space-y-4">
          <Card>
            <CardHeader>
            <CardTitle>Transações Anômalas Detectadas</CardTitle>
            <CardDescription>Valores significativamente acima da média ({formatValue(insights.mediaTransacao)})</CardDescription>
            </CardHeader>
            <CardContent>
              {insights.anomalias.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Award className="w-12 h-12 mx-auto mb-4" />
                  <p>Nenhuma anomalia detectada! Gastos consistentes.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {insights.anomalias.map((anomalia, index) => (
                    <div key={index} className="flex items-start gap-3 p-4 border rounded-lg bg-destructive/5">
                      <AlertTriangle className="w-5 h-5 text-destructive mt-1 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <p className="font-semibold truncate">{anomalia.descricao}</p>
                          <span className="text-lg font-bold text-destructive whitespace-nowrap">
                            {formatValue(anomalia.valor)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                          <span>{anomalia.fornecedor || 'Sem fornecedor'}</span>
                          <span>•</span>
                          <span>{format(new Date(anomalia.data), "dd/MM/yyyy", { locale: ptBR })}</span>
                          <span>•</span>
                          <span className="text-destructive font-medium">
                            {anomalia.desvio.toFixed(0)}x acima da média
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Função para processar insights dos dados
type TransacaoFinanceira = {
  valor: number;
  descricao?: string;
  data_vencimento: string | Date;
  fornecedor?: { nome?: string } | null;
  categoria?: { nome?: string } | null;
};

function processarInsights(transacoes: TransacaoFinanceira[]) {
  const totalGasto = transacoes.reduce((acc, t) => acc + (t.valor || 0), 0);
  const mediaTransacao = totalGasto / (transacoes.length || 1);
  
  // Top fornecedores
  const fornecedoresMap = new Map<string, { nome: string; total: number; transacoes: number; valores: number[] }>();
  transacoes.forEach(t => {
    const nome = t.fornecedor?.nome || 'Sem fornecedor';
    const current = fornecedoresMap.get(nome) || { nome, total: 0, transacoes: 0, valores: [] };
    current.total += t.valor || 0;
    current.transacoes += 1;
    current.valores.push(t.valor || 0);
    fornecedoresMap.set(nome, current);
  });

  const topFornecedores = Array.from(fornecedoresMap.values())
    .sort((a, b) => b.total - a.total);

  const frequenciaFornecedores = topFornecedores.map(f => ({
    nome: f.nome,
    transacoes: f.transacoes,
    media: f.total / f.transacoes
  })).sort((a, b) => b.transacoes - a.transacoes);

  // Categorias
  const categoriasMap = new Map<string, { nome: string; total: number; transacoes: number }>();
  transacoes.forEach(t => {
    const nome = t.categoria?.nome || 'Sem categoria';
    const current = categoriasMap.get(nome) || { nome, total: 0, transacoes: 0 };
    current.total += t.valor || 0;
    current.transacoes += 1;
    categoriasMap.set(nome, current);
  });

  const categorias = Array.from(categoriasMap.values())
    .sort((a, b) => b.total - a.total);

  // Gastos mensais
  const mesesMap = new Map<string, number>();
  transacoes.forEach(t => {
    const mes = format(new Date(t.data_vencimento), "MMM/yyyy", { locale: ptBR });
    mesesMap.set(mes, (mesesMap.get(mes) || 0) + (t.valor || 0));
  });

  const gastosMensais = Array.from(mesesMap.entries())
    .map(([mes, total]) => ({ mes, total, media: totalGasto / mesesMap.size }))
    .sort((a, b) => new Date(a.mes).getTime() - new Date(b.mes).getTime());

  const mesMaiorGasto = gastosMensais.reduce((max, curr) => curr.total > max.total ? curr : max, gastosMensais[0]);
  const mesMenorGasto = gastosMensais.reduce((min, curr) => curr.total < min.total ? curr : min, gastosMensais[0]);

  // Tendência (comparar primeira metade com segunda metade)
  const metade = Math.floor(gastosMensais.length / 2);
  const primeiraMetade = gastosMensais.slice(0, metade).reduce((acc, m) => acc + m.total, 0) / metade;
  const segundaMetade = gastosMensais.slice(metade).reduce((acc, m) => acc + m.total, 0) / (gastosMensais.length - metade);
  const tendencia = ((segundaMetade - primeiraMetade) / primeiraMetade) * 100;

  // Anomalias (transações 3x acima da média)
  const anomalias = transacoes
    .filter(t => t.valor > mediaTransacao * 3)
    .map(t => ({
      descricao: t.descricao,
      valor: t.valor,
      fornecedor: t.fornecedor?.nome,
      data: t.data_vencimento,
      desvio: t.valor / mediaTransacao
    }))
    .sort((a, b) => b.valor - a.valor);

  return {
    totalGasto,
    mediaMensal: totalGasto / (mesesMap.size || 1),
    mediaTransacao,
    totalFornecedores: fornecedoresMap.size,
    topFornecedores,
    frequenciaFornecedores,
    categorias,
    gastosMensais,
    mesMaiorGasto,
    mesMenorGasto,
    tendencia,
    anomalias
  };
}
