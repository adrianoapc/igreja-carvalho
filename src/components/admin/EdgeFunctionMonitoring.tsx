import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  TrendingUp,
  BarChart3,
  RefreshCw,
  Zap
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from "recharts";

interface FunctionStats {
  function_name: string;
  total_executions: number;
  successful: number;
  errors: number;
  timeouts: number;
  avg_execution_time_ms: number;
  max_execution_time_ms: number;
  min_execution_time_ms: number;
  last_execution: string;
  success_rate: number;
}

interface DailyStats {
  function_name: string;
  execution_date: string;
  total: number;
  successful: number;
  errors: number;
  avg_time_ms: number;
}

interface FunctionConfig {
  function_name: string;
  enabled: boolean;
  execution_count: number;
  last_execution: string;
  last_execution_status: string;
  schedule_description: string;
}

interface RecentLog {
  id: string;
  function_name: string;
  execution_time_ms: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

const chartConfig = {
  successful: {
    label: "Sucesso",
    color: "hsl(142, 71%, 45%)",
  },
  errors: {
    label: "Erros",
    color: "hsl(0, 84%, 60%)",
  },
  total: {
    label: "Total",
    color: "hsl(217, 91%, 60%)",
  },
};

export default function EdgeFunctionMonitoring() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<FunctionStats[]>([]);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [configs, setConfigs] = useState<FunctionConfig[]>([]);
  const [recentLogs, setRecentLogs] = useState<RecentLog[]>([]);
  const [selectedFunction, setSelectedFunction] = useState<string>("all");
  const [timeRange, setTimeRange] = useState<string>("7");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadStats(),
        loadDailyStats(),
        loadConfigs(),
        loadRecentLogs()
      ]);
    } catch (error: any) {
      console.error("Erro ao carregar dados:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar dados de monitoramento",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    const { data, error } = await supabase
      .from("view_edge_function_stats")
      .select("*");
    
    if (error) throw error;
    setStats((data as FunctionStats[]) || []);
  };

  const loadDailyStats = async () => {
    const { data, error } = await supabase
      .from("view_edge_function_daily_stats")
      .select("*")
      .order("execution_date", { ascending: true });
    
    if (error) throw error;
    setDailyStats((data as DailyStats[]) || []);
  };

  const loadConfigs = async () => {
    const { data, error } = await supabase
      .from("edge_function_config")
      .select("*")
      .order("function_name");
    
    if (error) throw error;
    setConfigs((data as FunctionConfig[]) || []);
  };

  const loadRecentLogs = async () => {
    const { data, error } = await supabase
      .from("edge_function_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (error) throw error;
    setRecentLogs((data as RecentLog[]) || []);
  };

  // Calcular métricas gerais
  const totalExecutions = stats.reduce((acc, s) => acc + (s.total_executions || 0), 0);
  const totalSuccess = stats.reduce((acc, s) => acc + (s.successful || 0), 0);
  const totalErrors = stats.reduce((acc, s) => acc + (s.errors || 0), 0);
  const avgSuccessRate = totalExecutions > 0 ? ((totalSuccess / totalExecutions) * 100).toFixed(1) : "0";
  const avgResponseTime = stats.length > 0 
    ? (stats.reduce((acc, s) => acc + (s.avg_execution_time_ms || 0), 0) / stats.length).toFixed(0)
    : "0";

  // Preparar dados para gráfico
  const chartData = dailyStats
    .filter(d => selectedFunction === "all" || d.function_name === selectedFunction)
    .reduce((acc, curr) => {
      const dateKey = curr.execution_date;
      const existing = acc.find(a => a.date === dateKey);
      if (existing) {
        existing.successful += curr.successful || 0;
        existing.errors += curr.errors || 0;
        existing.total += curr.total || 0;
      } else {
        acc.push({
          date: dateKey,
          dateLabel: format(new Date(dateKey), "dd/MM", { locale: ptBR }),
          successful: curr.successful || 0,
          errors: curr.errors || 0,
          total: curr.total || 0
        });
      }
      return acc;
    }, [] as any[])
    .slice(-parseInt(timeRange));

  // Lista de funções para filtro
  const functionNames = [...new Set([...stats.map(s => s.function_name), ...configs.map(c => c.function_name)])];

  // Filtrar logs
  const filteredLogs = selectedFunction === "all" 
    ? recentLogs 
    : recentLogs.filter(l => l.function_name === selectedFunction);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "success":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Sucesso</Badge>;
      case "error":
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">Erro</Badge>;
      case "timeout":
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">Timeout</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header com filtros */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Monitoramento de Edge Functions</h2>
          <p className="text-sm text-muted-foreground">Estatísticas de uso e performance</p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedFunction} onValueChange={setSelectedFunction}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar função" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as funções</SelectItem>
              {functionNames.map(fn => (
                <SelectItem key={fn} value={fn}>{fn}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 dias</SelectItem>
              <SelectItem value="14">14 dias</SelectItem>
              <SelectItem value="30">30 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={loadAllData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Total de Execuções
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalExecutions.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Taxa de Sucesso
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{avgSuccessRate}%</div>
            <p className="text-xs text-muted-foreground">{totalSuccess} execuções bem-sucedidas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-600" />
              Erros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{totalErrors}</div>
            <p className="text-xs text-muted-foreground">últimos 30 dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Tempo Médio
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgResponseTime}ms</div>
            <p className="text-xs text-muted-foreground">tempo de resposta</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de execuções */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Execuções por Dia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="dateLabel" 
                  tick={{ fontSize: 12 }} 
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                <Bar 
                  dataKey="successful" 
                  name="Sucesso" 
                  fill="hsl(142, 71%, 45%)" 
                  radius={[4, 4, 0, 0]}
                />
                <Bar 
                  dataKey="errors" 
                  name="Erros" 
                  fill="hsl(0, 84%, 60%)" 
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Estatísticas por função */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance por Função
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead className="text-right">Execuções</TableHead>
                  <TableHead className="text-right">Sucesso</TableHead>
                  <TableHead className="text-right">Erros</TableHead>
                  <TableHead className="text-right">Taxa</TableHead>
                  <TableHead className="text-right">Tempo Médio</TableHead>
                  <TableHead className="text-right">Última Execução</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      Nenhuma execução registrada ainda
                    </TableCell>
                  </TableRow>
                ) : (
                  stats.map((stat) => (
                    <TableRow key={stat.function_name}>
                      <TableCell className="font-medium">{stat.function_name}</TableCell>
                      <TableCell className="text-right">{stat.total_executions}</TableCell>
                      <TableCell className="text-right text-green-600">{stat.successful}</TableCell>
                      <TableCell className="text-right text-red-600">{stat.errors}</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          className={
                            (stat.success_rate || 0) >= 95 
                              ? "bg-green-500/10 text-green-600" 
                              : (stat.success_rate || 0) >= 80 
                                ? "bg-yellow-500/10 text-yellow-600"
                                : "bg-red-500/10 text-red-600"
                          }
                        >
                          {stat.success_rate || 0}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{stat.avg_execution_time_ms || 0}ms</TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {stat.last_execution 
                          ? format(new Date(stat.last_execution), "dd/MM HH:mm", { locale: ptBR })
                          : "-"
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Logs recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Execuções Recentes
          </CardTitle>
          <CardDescription>Últimas 50 execuções registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Função</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tempo</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead className="text-right">Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.slice(0, 20).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-medium">{log.function_name}</TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-right">{log.execution_time_ms || "-"}ms</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground">
                        {log.error_message || "-"}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {format(new Date(log.created_at), "dd/MM HH:mm:ss", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
