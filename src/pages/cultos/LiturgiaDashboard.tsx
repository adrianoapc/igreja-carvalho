import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Users, Clock, Calendar, Award, TrendingUp, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface ResponsavelStats {
  nome: string;
  total_escalacoes: number;
  tipos: string[];
}

interface TipoStats {
  tipo: string;
  quantidade: number;
}

interface DashboardStats {
  total_cultos: number;
  total_itens: number;
  duracao_media: number;
  responsaveis_unicos: number;
}

const COLORS = ['#8B5CF6', '#EC4899', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#14B8A6'];

export default function LiturgiaDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    total_cultos: 0,
    total_itens: 0,
    duracao_media: 0,
    responsaveis_unicos: 0
  });
  const [responsaveisRanking, setResponsaveisRanking] = useState<ResponsavelStats[]>([]);
  const [tiposDistribuicao, setTiposDistribuicao] = useState<TipoStats[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Buscar todos os itens de liturgia com responsáveis
      const { data: liturgiaItens, error: liturgiaError } = await supabase
        .from("liturgia_culto")
        .select(`
          id,
          tipo,
          duracao_minutos,
          responsavel_id,
          responsavel_externo,
          culto_id,
          profiles:responsavel_id(nome)
        `);

      if (liturgiaError) throw liturgiaError;

      // Calcular estatísticas gerais
      const cultosUnicos = new Set(liturgiaItens?.map(item => item.culto_id) || []).size;
      const totalItens = liturgiaItens?.length || 0;
      const duracaoTotal = liturgiaItens?.reduce((sum, item) => sum + (item.duracao_minutos || 0), 0) || 0;
      const duracaoMedia = totalItens > 0 ? Math.round(duracaoTotal / cultosUnicos) : 0;

      // Calcular responsáveis únicos
      const responsaveisSet = new Set(
        liturgiaItens
          ?.filter(item => item.responsavel_id || item.responsavel_externo)
          .map(item => item.responsavel_id || item.responsavel_externo)
      );

      setStats({
        total_cultos: cultosUnicos,
        total_itens: totalItens,
        duracao_media: duracaoMedia,
        responsaveis_unicos: responsaveisSet.size
      });

      // Calcular ranking de responsáveis
      const responsaveisMap = new Map<string, { nome: string; count: number; tipos: Set<string> }>();
      
      liturgiaItens?.forEach(item => {
        const nome = item.profiles?.nome || item.responsavel_externo;
        const id = item.responsavel_id || item.responsavel_externo;
        
        if (nome && id) {
          if (!responsaveisMap.has(id)) {
            responsaveisMap.set(id, { nome, count: 0, tipos: new Set() });
          }
          const responsavel = responsaveisMap.get(id)!;
          responsavel.count++;
          responsavel.tipos.add(item.tipo);
        }
      });

      const ranking: ResponsavelStats[] = Array.from(responsaveisMap.values())
        .map(r => ({
          nome: r.nome,
          total_escalacoes: r.count,
          tipos: Array.from(r.tipos)
        }))
        .sort((a, b) => b.total_escalacoes - a.total_escalacoes)
        .slice(0, 10);

      setResponsaveisRanking(ranking);

      // Calcular distribuição de tipos
      const tiposMap = new Map<string, number>();
      liturgiaItens?.forEach(item => {
        tiposMap.set(item.tipo, (tiposMap.get(item.tipo) || 0) + 1);
      });

      const distribuicao: TipoStats[] = Array.from(tiposMap.entries())
        .map(([tipo, quantidade]) => ({ tipo, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade);

      setTiposDistribuicao(distribuicao);

    } catch (error: any) {
      toast.error("Erro ao carregar dashboard", {
        description: error.message
      });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Liturgia</h1>
          <p className="text-muted-foreground mt-1">Carregando estatísticas...</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-4 rounded-full" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dashboard de Liturgia</h1>
          <p className="text-muted-foreground mt-1">
            Estatísticas e análise de participação na liturgia
          </p>
        </div>
        <Button onClick={() => navigate("/cultos/templates")} variant="outline">
          <FileText className="mr-2 h-4 w-4" />
          Templates
        </Button>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Cultos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_cultos}</div>
            <p className="text-xs text-muted-foreground">Com liturgia cadastrada</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Itens de Liturgia</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_itens}</div>
            <p className="text-xs text-muted-foreground">Total de itens criados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duração Média</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.duracao_media}</div>
            <p className="text-xs text-muted-foreground">Minutos por culto</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Responsáveis</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.responsaveis_unicos}</div>
            <p className="text-xs text-muted-foreground">Pessoas diferentes</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Ranking de Responsáveis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              Top 10 Responsáveis Mais Escalados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {responsaveisRanking.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum responsável escalado ainda
              </p>
            ) : (
              <div className="space-y-4">
                {responsaveisRanking.map((responsavel, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge variant="outline" className="shrink-0">
                        #{index + 1}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{responsavel.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {responsavel.tipos.join(", ")}
                        </p>
                      </div>
                    </div>
                    <Badge className="shrink-0">
                      {responsavel.total_escalacoes}x
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Gráfico de Distribuição de Tipos */}
        <Card>
          <CardHeader>
            <CardTitle>Distribuição por Tipo de Liturgia</CardTitle>
          </CardHeader>
          <CardContent>
            {tiposDistribuicao.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum item de liturgia cadastrado
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={tiposDistribuicao}
                    dataKey="quantidade"
                    nameKey="tipo"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ tipo, quantidade }) => `${tipo}: ${quantidade}`}
                  >
                    {tiposDistribuicao.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras - Top Responsáveis */}
      {responsaveisRanking.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Comparativo de Participação</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={responsaveisRanking.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="nome" 
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="total_escalacoes" 
                  fill="#8B5CF6" 
                  name="Escalações"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}