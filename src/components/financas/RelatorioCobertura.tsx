import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { useHideValues } from "@/hooks/useHideValues";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";
import { 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  Clock, 
  BarChart3,
  PieChartIcon,
  RefreshCw 
} from "lucide-react";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

interface CoberturaData {
  igreja_id: string;
  filial_id: string | null;
  conta_id: string;
  conta_nome: string;
  periodo: string;
  total_extratos: number;
  extratos_reconciliados: number;
  extratos_pendentes: number;
  percentual_cobertura: number;
  valor_total: number;
  valor_reconciliado: number;
  valor_pendente: number;
}

interface EstatisticasData {
  igreja_id: string;
  filial_id: string | null;
  conta_id: string;
  periodo: string;
  tipo_reconciliacao: string;
  quantidade: number;
  valor_total: number;
  score_medio: number | null;
  diferenca_media: number | null;
}

export function RelatorioCobertura() {
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const { formatValue } = useHideValues();
  const [periodoMeses, setPeriodoMeses] = useState("6");
  const [contaFiltro, setContaFiltro] = useState<string>("all");

  // Fetch contas for filter
  const { data: contas } = useQuery({
    queryKey: ["contas-relatorio", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch cobertura data
  const { data: coberturaData, isLoading: loadingCobertura, refetch: refetchCobertura } = useQuery({
    queryKey: ["reconciliacao-cobertura", igrejaId, filialId, isAllFiliais, periodoMeses, contaFiltro],
    queryFn: async () => {
      if (!igrejaId) return [];
      
      const dataInicio = format(startOfMonth(subMonths(new Date(), parseInt(periodoMeses))), "yyyy-MM-dd");
      const dataFim = format(endOfMonth(new Date()), "yyyy-MM-dd");
      
      let query = supabase
        .from("extratos_bancarios")
        .select(`
          id,
          conta_id,
          data_transacao,
          valor,
          reconciliado,
          contas!inner(nome)
        `)
        .eq("igreja_id", igrejaId)
        .gte("data_transacao", dataInicio)
        .lte("data_transacao", dataFim);
      
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      
      if (contaFiltro !== "all") {
        query = query.eq("conta_id", contaFiltro);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Processar dados para agrupar por mês e conta
      const grouped = (data || []).reduce((acc, item) => {
        const periodo = format(new Date(item.data_transacao), "yyyy-MM");
        const key = `${periodo}-${item.conta_id}`;
        
        if (!acc[key]) {
          acc[key] = {
            periodo,
            conta_id: item.conta_id,
            conta_nome: (item.contas as any)?.nome || "Sem conta",
            total_extratos: 0,
            extratos_reconciliados: 0,
            extratos_pendentes: 0,
            valor_total: 0,
            valor_reconciliado: 0,
            valor_pendente: 0,
          };
        }
        
        acc[key].total_extratos++;
        acc[key].valor_total += Math.abs(Number(item.valor));
        
        if (item.reconciliado) {
          acc[key].extratos_reconciliados++;
          acc[key].valor_reconciliado += Math.abs(Number(item.valor));
        } else {
          acc[key].extratos_pendentes++;
          acc[key].valor_pendente += Math.abs(Number(item.valor));
        }
        
        return acc;
      }, {} as Record<string, any>);
      
      // Calcular percentuais
      return Object.values(grouped).map((item: any) => ({
        ...item,
        percentual_cobertura: item.total_extratos > 0 
          ? Math.round((item.extratos_reconciliados / item.total_extratos) * 100) 
          : 0,
      })) as CoberturaData[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch estatísticas por tipo
  const { data: estatisticasData, isLoading: loadingEstatisticas } = useQuery({
    queryKey: ["reconciliacao-estatisticas", igrejaId, filialId, isAllFiliais, periodoMeses, contaFiltro],
    queryFn: async () => {
      if (!igrejaId) return [];
      
      const dataInicio = startOfMonth(subMonths(new Date(), parseInt(periodoMeses)));
      
      let query = supabase
        .from("reconciliacao_audit_logs")
        .select("*")
        .eq("igreja_id", igrejaId)
        .gte("created_at", dataInicio.toISOString());
      
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      
      if (contaFiltro !== "all") {
        query = query.eq("conta_id", contaFiltro);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      // Agrupar por tipo
      const grouped = (data || []).reduce((acc, item) => {
        const tipo = item.tipo_reconciliacao;
        if (!acc[tipo]) {
          acc[tipo] = {
            tipo_reconciliacao: tipo,
            quantidade: 0,
            valor_total: 0,
            scores: [] as number[],
            diferencas: [] as number[],
          };
        }
        acc[tipo].quantidade++;
        acc[tipo].valor_total += Math.abs(Number(item.valor_extrato || 0));
        if (item.score) acc[tipo].scores.push(item.score);
        if (item.diferenca) acc[tipo].diferencas.push(Number(item.diferenca));
        return acc;
      }, {} as Record<string, any>);
      
      return Object.values(grouped).map((item: any) => ({
        ...item,
        score_medio: item.scores.length > 0 
          ? Math.round(item.scores.reduce((a: number, b: number) => a + b, 0) / item.scores.length)
          : null,
        diferenca_media: item.diferencas.length > 0
          ? item.diferencas.reduce((a: number, b: number) => a + b, 0) / item.diferencas.length
          : null,
      })) as EstatisticasData[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Calcular resumo geral
  const resumo = coberturaData?.reduce(
    (acc, item) => ({
      totalExtratos: acc.totalExtratos + item.total_extratos,
      reconciliados: acc.reconciliados + item.extratos_reconciliados,
      pendentes: acc.pendentes + item.extratos_pendentes,
      valorTotal: acc.valorTotal + item.valor_total,
      valorReconciliado: acc.valorReconciliado + item.valor_reconciliado,
      valorPendente: acc.valorPendente + item.valor_pendente,
    }),
    { totalExtratos: 0, reconciliados: 0, pendentes: 0, valorTotal: 0, valorReconciliado: 0, valorPendente: 0 }
  ) || { totalExtratos: 0, reconciliados: 0, pendentes: 0, valorTotal: 0, valorReconciliado: 0, valorPendente: 0 };

  const percentualGeral = resumo.totalExtratos > 0 
    ? Math.round((resumo.reconciliados / resumo.totalExtratos) * 100)
    : 0;

  // Preparar dados para gráficos
  const chartDataMensal = coberturaData
    ?.reduce((acc, item) => {
      const existing = acc.find(a => a.periodo === item.periodo);
      if (existing) {
        existing.reconciliados += item.extratos_reconciliados;
        existing.pendentes += item.extratos_pendentes;
      } else {
        acc.push({
          periodo: item.periodo,
          periodoLabel: format(new Date(item.periodo + "-01"), "MMM/yy", { locale: ptBR }),
          reconciliados: item.extratos_reconciliados,
          pendentes: item.extratos_pendentes,
        });
      }
      return acc;
    }, [] as any[])
    .sort((a, b) => a.periodo.localeCompare(b.periodo)) || [];

  const pieDataTipo = estatisticasData?.map(item => ({
    name: item.tipo_reconciliacao === "automatica" ? "Automática" 
        : item.tipo_reconciliacao === "manual" ? "Manual" 
        : "Em Lote",
    value: item.quantidade,
    valor: item.valor_total,
  })) || [];

  const isLoading = igrejaLoading || filialLoading || loadingCobertura || loadingEstatisticas;

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Período:</span>
          <Select value={periodoMeses} onValueChange={setPeriodoMeses}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Conta:</span>
          <Select value={contaFiltro} onValueChange={setContaFiltro}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Todas as contas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {contas?.map(conta => (
                <SelectItem key={conta.id} value={conta.id}>
                  {conta.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetchCobertura()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Cobertura Geral</p>
                <p className="text-2xl font-bold">{percentualGeral}%</p>
              </div>
              {percentualGeral >= 80 ? (
                <TrendingUp className="w-8 h-8 text-green-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-orange-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Reconciliados</p>
                <p className="text-2xl font-bold text-green-600">{resumo.reconciliados}</p>
              </div>
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pendentes</p>
                <p className="text-2xl font-bold text-orange-600">{resumo.pendentes}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div>
              <p className="text-sm text-muted-foreground">Valor Pendente</p>
              <p className="text-2xl font-bold">{formatValue(resumo.valorPendente)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Evolução Mensal */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="w-5 h-5" />
              Evolução Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {chartDataMensal.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartDataMensal}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="periodoLabel" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))" 
                    }}
                  />
                  <Legend />
                  <Bar dataKey="reconciliados" name="Reconciliados" fill="hsl(var(--chart-1))" />
                  <Bar dataKey="pendentes" name="Pendentes" fill="hsl(var(--chart-2))" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sem dados para o período selecionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Por Tipo de Reconciliação */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <PieChartIcon className="w-5 h-5" />
              Por Tipo de Reconciliação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pieDataTipo.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieDataTipo}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieDataTipo.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number, name: string, props: any) => [
                      `${value} extratos`,
                      name
                    ]}
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))" 
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                Sem logs de auditoria ainda
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento por Conta */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detalhamento por Conta</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : coberturaData && coberturaData.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(
                coberturaData.reduce((acc, item) => {
                  if (!acc[item.conta_nome]) {
                    acc[item.conta_nome] = {
                      total: 0,
                      reconciliados: 0,
                      pendentes: 0,
                      valorTotal: 0,
                      valorReconciliado: 0,
                    };
                  }
                  acc[item.conta_nome].total += item.total_extratos;
                  acc[item.conta_nome].reconciliados += item.extratos_reconciliados;
                  acc[item.conta_nome].pendentes += item.extratos_pendentes;
                  acc[item.conta_nome].valorTotal += item.valor_total;
                  acc[item.conta_nome].valorReconciliado += item.valor_reconciliado;
                  return acc;
                }, {} as Record<string, any>)
              ).map(([contaNome, dados]) => {
                const percentual = dados.total > 0 
                  ? Math.round((dados.reconciliados / dados.total) * 100) 
                  : 0;
                return (
                  <div 
                    key={contaNome} 
                    className="p-4 rounded-lg border bg-muted/20"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{contaNome}</span>
                      <Badge 
                        variant={percentual >= 80 ? "default" : percentual >= 50 ? "secondary" : "destructive"}
                      >
                        {percentual}% cobertura
                      </Badge>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium">{dados.total}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Reconciliados</p>
                        <p className="font-medium text-green-600">{dados.reconciliados}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Pendentes</p>
                        <p className="font-medium text-orange-600">{dados.pendentes}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Valor Pendente</p>
                        <p className="font-medium">{formatValue(dados.valorTotal - dados.valorReconciliado)}</p>
                      </div>
                    </div>
                    {/* Barra de progresso */}
                    <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all" 
                        style={{ width: `${percentual}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado encontrado para o período selecionado
            </div>
          )}
        </CardContent>
      </Card>

      {/* Estatísticas por Tipo */}
      {estatisticasData && estatisticasData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estatísticas por Tipo de Reconciliação</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              {estatisticasData.map((stat) => (
                <div 
                  key={stat.tipo_reconciliacao} 
                  className="p-4 rounded-lg border bg-muted/20"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant={
                      stat.tipo_reconciliacao === "automatica" ? "default" 
                      : stat.tipo_reconciliacao === "manual" ? "secondary" 
                      : "outline"
                    }>
                      {stat.tipo_reconciliacao === "automatica" ? "Automática" 
                       : stat.tipo_reconciliacao === "manual" ? "Manual" 
                       : "Em Lote"}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Quantidade:</span>
                      <span className="font-medium">{stat.quantidade}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Valor Total:</span>
                      <span className="font-medium">{formatValue(stat.valor_total)}</span>
                    </div>
                    {stat.score_medio !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Score Médio:</span>
                        <span className="font-medium">{stat.score_medio}</span>
                      </div>
                    )}
                    {stat.diferenca_media !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Diferença Média:</span>
                        <span className="font-medium">{formatValue(stat.diferenca_media)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
