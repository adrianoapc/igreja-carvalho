import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Heart, Info, TrendingUp, TrendingDown, MessageCircle, Clock, User, Brain, AlertTriangle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from "recharts";
import { format, subDays, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import AlertasCriticos from "@/components/sentimentos/AlertasCriticos";

type SentimentoTipo = 'feliz' | 'cuidadoso' | 'abencoado' | 'grato' | 'angustiado' | 'sozinho' | 'triste' | 'doente' | 'com_pouca_fe';

interface SentimentoConfig {
  emoji: string;
  label: string;
  color: string;
  type: 'positive' | 'negative';
}

const sentimentosConfig: Record<SentimentoTipo, SentimentoConfig> = {
  feliz: { emoji: '😊', label: 'Feliz', color: 'text-green-600', type: 'positive' },
  cuidadoso: { emoji: '😇', label: 'Cuidadoso', color: 'text-blue-600', type: 'positive' },
  abencoado: { emoji: '😇', label: 'Abençoado', color: 'text-purple-600', type: 'positive' },
  grato: { emoji: '😄', label: 'Grato', color: 'text-yellow-600', type: 'positive' },
  angustiado: { emoji: '😔', label: 'Angustiado', color: 'text-orange-600', type: 'negative' },
  sozinho: { emoji: '😢', label: 'Sozinho', color: 'text-pink-600', type: 'negative' },
  triste: { emoji: '😭', label: 'Triste', color: 'text-red-600', type: 'negative' },
  doente: { emoji: '🤢', label: 'Doente', color: 'text-green-800', type: 'negative' },
  com_pouca_fe: { emoji: '😰', label: 'Com pouca fé', color: 'text-gray-600', type: 'negative' }
};

interface TrendData {
  data: string;
  positivos: number;
  negativos: number;
}

interface SentimentoRecord {
  id: string;
  pessoa_id: string;
  sentimento: SentimentoTipo;
  mensagem: string | null;
  data_registro: string;
  analise_ia_titulo: string | null;
  analise_ia_motivo: string | null;
  analise_ia_gravidade: string | null;
  analise_ia_resposta: string | null;
  profiles: {
    nome: string;
  } | null;
}

export default function Sentimentos() {
  const navigate = useNavigate();
  const [periodo, setPeriodo] = useState("7");
  const [stats, setStats] = useState<Record<SentimentoTipo, number>>({
    feliz: 0,
    cuidadoso: 0,
    abencoado: 0,
    grato: 0,
    angustiado: 0,
    sozinho: 0,
    triste: 0,
    doente: 0,
    com_pouca_fe: 0
  });
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [totalRegistros, setTotalRegistros] = useState(0);
  const [historico, setHistorico] = useState<SentimentoRecord[]>([]);
  const [expandedComment, setExpandedComment] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    fetchHistorico();
  }, [periodo]);

  const fetchStats = async () => {
    try {
      const dias = parseInt(periodo);
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      const { data, error } = await supabase
        .from('sentimentos_membros')
        .select('sentimento, data_registro')
        .gte('data_registro', dataInicio.toISOString())
        .order('data_registro', { ascending: true });

      if (error) throw error;

      // Contar sentimentos
      const counts: Record<string, number> = {};
      data?.forEach(item => {
        counts[item.sentimento] = (counts[item.sentimento] || 0) + 1;
      });

      setStats({
        feliz: counts.feliz || 0,
        cuidadoso: counts.cuidadoso || 0,
        abencoado: counts.abencoado || 0,
        grato: counts.grato || 0,
        angustiado: counts.angustiado || 0,
        sozinho: counts.sozinho || 0,
        triste: counts.triste || 0,
        doente: counts.doente || 0,
        com_pouca_fe: counts.com_pouca_fe || 0
      });

      setTotalRegistros(data?.length || 0);

      // Preparar dados de tendência
      const trend: Record<string, { positivos: number; negativos: number }> = {};
      
      data?.forEach(item => {
        const dia = format(new Date(item.data_registro), 'dd/MM', { locale: ptBR });
        if (!trend[dia]) {
          trend[dia] = { positivos: 0, negativos: 0 };
        }
        
        const config = sentimentosConfig[item.sentimento as SentimentoTipo];
        if (config.type === 'positive') {
          trend[dia].positivos++;
        } else {
          trend[dia].negativos++;
        }
      });

      const trendArray: TrendData[] = Object.entries(trend).map(([data, values]) => ({
        data,
        ...values
      }));

      setTrendData(trendArray);
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  const fetchHistorico = async () => {
    try {
      const dias = parseInt(periodo);
      const dataInicio = new Date();
      dataInicio.setDate(dataInicio.getDate() - dias);

      const { data, error } = await supabase
        .from('sentimentos_membros')
        .select(`
          id,
          pessoa_id,
          sentimento,
          mensagem,
          data_registro,
          analise_ia_titulo,
          analise_ia_motivo,
          analise_ia_gravidade,
          analise_ia_resposta,
          profiles!sentimentos_membros_pessoa_id_fkey(nome)
        `)
        .gte('data_registro', dataInicio.toISOString())
        .order('data_registro', { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistorico(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    }
  };

  const totalPositivos = stats.feliz + stats.cuidadoso + stats.abencoado + stats.grato;
  const totalNegativos = stats.angustiado + stats.sozinho + stats.triste + stats.doente + stats.com_pouca_fe;
  const percentualPositivo = totalRegistros > 0 ? ((totalPositivos / totalRegistros) * 100).toFixed(1) : "0";

  const pieData = [
    { name: 'Positivos', value: totalPositivos, color: 'hsl(var(--chart-1))' },
    { name: 'Negativos', value: totalNegativos, color: 'hsl(var(--chart-2))' }
  ];

  const barData = Object.entries(sentimentosConfig).map(([key, config]) => ({
    name: config.label,
    value: stats[key as SentimentoTipo],
    fill: config.type === 'positive' ? 'hsl(var(--chart-1))' : 'hsl(var(--chart-2))'
  }));

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/intercessao")}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard de Bem-Estar</h1>
            <p className="text-sm md:text-base text-muted-foreground">
              Métricas e análise de sentimentos da igreja
            </p>
          </div>
        </div>
      </div>

      {/* Métricas Gerais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
        <Card>
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total de Registros</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="text-2xl md:text-3xl font-bold text-foreground">{totalRegistros}</div>
            <p className="text-xs text-muted-foreground mt-1">Últimos {periodo} dias</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sentimentos Positivos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              <div className="text-2xl md:text-3xl font-bold text-green-600">{totalPositivos}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{percentualPositivo}% do total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 md:p-6 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Sentimentos Negativos</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <div className="flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              <div className="text-2xl md:text-3xl font-bold text-red-600">{totalNegativos}</div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{(100 - parseFloat(percentualPositivo)).toFixed(1)}% do total</p>
          </CardContent>
        </Card>
      </div>

      {/* Alertas Críticos */}
      <AlertasCriticos />

      {/* Histórico de Sentimentos com Comentários */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-primary" />
              <CardTitle className="text-base md:text-lg">Registros Recentes</CardTitle>
            </div>
            <Select value={periodo} onValueChange={setPeriodo}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="15">15 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum registro no período selecionado.
            </p>
          ) : (
            <div className="space-y-3">
              {historico.map((registro) => {
                const config = sentimentosConfig[registro.sentimento];
                const hasComment = !!registro.mensagem;
                const isExpanded = expandedComment === registro.id;
                const hasAiAnalysis = !!registro.analise_ia_titulo;
                
                // Severity badge styling
                const getSeverityBadge = (gravidade: string | null) => {
                  switch (gravidade) {
                    case 'critica':
                      return 'bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400';
                    case 'media':
                      return 'bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400';
                    case 'baixa':
                      return 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400';
                    default:
                      return 'bg-muted text-muted-foreground';
                  }
                };

                return (
                  <div
                    key={registro.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors ${
                      registro.analise_ia_gravidade === 'critica' ? 'border-red-300 dark:border-red-700' : ''
                    }`}
                  >
                    <div className="text-2xl flex-shrink-0">{config.emoji}</div>
                    <div className="flex-1 min-w-0">
                      {/* AI Title or Member Name */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {hasAiAnalysis ? (
                          <>
                            <span className="font-medium text-sm">
                              {registro.analise_ia_titulo}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${getSeverityBadge(registro.analise_ia_gravidade)}`}
                            >
                              {registro.analise_ia_gravidade === 'critica' && <AlertTriangle className="w-3 h-3 mr-1" />}
                              {registro.analise_ia_gravidade || 'Analisando...'}
                            </Badge>
                            {registro.analise_ia_motivo && (
                              <Badge variant="secondary" className="text-xs">
                                {registro.analise_ia_motivo}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="font-medium text-sm truncate">
                              {registro.profiles?.nome || 'Membro'}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={`text-xs ${config.type === 'negative' ? 'border-destructive/50 text-destructive' : ''}`}
                            >
                              {config.label}
                            </Badge>
                          </>
                        )}
                        {hasComment && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0"
                                  onClick={() => setExpandedComment(isExpanded ? null : registro.id)}
                                >
                                  <MessageCircle className="w-4 h-4 text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-sm">{registro.mensagem}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {hasAiAnalysis && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Brain className="w-4 h-4 text-purple-500" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs">
                                <p className="text-xs font-medium mb-1">Análise IA</p>
                                <p className="text-xs">{registro.analise_ia_resposta}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                      
                      {/* Subinfo: Member name (when AI title is shown) + timestamp */}
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {hasAiAnalysis && (
                          <>
                            <User className="w-3 h-3" />
                            <span>{registro.profiles?.nome || 'Membro'}</span>
                            <span>•</span>
                          </>
                        )}
                        <Clock className="w-3 h-3" />
                        <span>
                          {format(new Date(registro.data_registro), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      
                      {/* Expanded comment */}
                      {hasComment && isExpanded && (
                        <div className="mt-2 p-2 bg-muted rounded text-sm space-y-2">
                          <p className="text-foreground">{registro.mensagem}</p>
                          {registro.analise_ia_resposta && (
                            <div className="pt-2 border-t border-border">
                              <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                                <Brain className="w-3 h-3" /> Resposta Pastoral IA:
                              </p>
                              <p className="text-sm text-primary/90 italic">
                                "{registro.analise_ia_resposta}"
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
        {/* Gráfico de Tendência */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">Tendência ao Longo do Tempo</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="data" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="positivos" 
                  stroke="hsl(var(--chart-1))" 
                  strokeWidth={2}
                  name="Positivos"
                />
                <Line 
                  type="monotone" 
                  dataKey="negativos" 
                  stroke="hsl(var(--chart-2))" 
                  strokeWidth={2}
                  name="Negativos"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Distribuição */}
        <Card>
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-base md:text-lg">Distribuição Geral</CardTitle>
          </CardHeader>
          <CardContent className="p-4 md:p-6 pt-0">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Detalhamento por Sentimento */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            <CardTitle className="text-base md:text-lg">Detalhamento por Sentimento</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs text-xs">
                    Os membros podem registrar diariamente como estão se sentindo.
                    Sentimentos negativos direcionam para pedidos de oração.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                angle={-45}
                textAnchor="end"
                height={100}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Sobre os Sentimentos</CardTitle>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0 space-y-3 text-sm text-muted-foreground">
          <p>
            <strong>Sentimentos Positivos (Feliz, Cuidadoso):</strong> Membros recebem mensagem de agradecimento.
          </p>
          <p>
            <strong>Sentimentos de Gratidão (Grato, Abençoado):</strong> Membros são convidados a compartilhar um testemunho.
          </p>
          <p>
            <strong>Sentimentos Negativos:</strong> Membros são direcionados para criar um pedido de oração e recebem apoio.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}