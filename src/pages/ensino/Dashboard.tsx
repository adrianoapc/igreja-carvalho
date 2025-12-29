import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  Users,
  Calendar,
  TrendingUp,
  BookOpen,
  Clock,
  ArrowRight,
  AlertCircle,
  Play,
  CheckCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function EnsinoDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<"hoje" | "semana" | "mes">("semana");

  // Query para estatísticas de ensino
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["ensino-stats", selectedPeriod],
    queryFn: async () => {
      const now = new Date();
      let startDate: Date;
      let weekStart: Date;

      switch (selectedPeriod) {
        case "hoje":
          startDate = new Date(now.setHours(0, 0, 0, 0));
          break;
        case "semana":
          weekStart = new Date(now);
          weekStart.setDate(now.getDate() - now.getDay());
          startDate = new Date(weekStart.setHours(0, 0, 0, 0));
          break;
        case "mes":
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
      }

      // Total de aulas no período
      const { data: aulas, error: aulasError } = await supabase
        .from("aulas")
        .select("*")
        .gte("data_inicio", startDate.toISOString())
        .lte("data_inicio", new Date().toISOString());

      if (aulasError) throw aulasError;

      // Total de alunos ativos (com presença no período)
      const { data: presencas, error: presencasError } = await supabase
        .from("presencas_aula")
        .select("aluno_id")
        .gte("created_at", startDate.toISOString());

      if (presencasError) throw presencasError;

      const alunosUnicos = new Set(presencas?.map((p) => p.aluno_id) || []).size;

      // Total de jornadas ativas
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: jornadas, error: jornadasError } = await (supabase as any)
        .from("jornadas")
        .select("id")
        .eq("ativo", true) as { data: { id: string }[] | null; error: Error | null };

      if (jornadasError) throw jornadasError;

      // Taxa de conclusão (placeholder - seria baseado em progresso real)
      const taxaConclusao = aulas && aulas.length > 0 ? Math.round((alunosUnicos / aulas.length) * 10) : 0;

      return {
        totalAulas: aulas?.length || 0,
        alunosAtivos: alunosUnicos,
        jornadasAtivas: jornadas?.length || 0,
        taxaConclusao: Math.min(taxaConclusao, 100),
      };
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  // Query para próximas aulas
  const { data: proximasAulas } = useQuery({
    queryKey: ["ensino-proximas-aulas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aulas")
        .select(`
          *,
          sala:salas(nome),
          professor:profiles!aulas_professor_id_fkey(nome, avatar_url)
        `)
        .gte("data_inicio", new Date().toISOString())
        .order("data_inicio", { ascending: true })
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 60000,
  });

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      time: date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
      agendada: { label: "Agendada", variant: "outline" },
      em_andamento: { label: "Em Andamento", variant: "default" },
      concluida: { label: "Concluída", variant: "secondary" },
    };

    const config = statusMap[status] || { label: status, variant: "outline" };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GraduationCap className="w-8 h-8 text-primary" />
            Ministério de Ensino
          </h1>
          <p className="text-muted-foreground mt-1">
            Painel de controle e estatísticas de ensino
          </p>
        </div>

        <Link to="/ensino?tab=agenda">
          <Button size="lg" className="w-full sm:w-auto">
            <Calendar className="w-5 h-5 mr-2" />
            Ver Cronograma
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Link>
      </div>

      {/* Filtro de Período */}
      <div className="flex gap-2">
        <Button
          variant={selectedPeriod === "hoje" ? "default" : "outline"}
          onClick={() => setSelectedPeriod("hoje")}
        >
          Hoje
        </Button>
        <Button
          variant={selectedPeriod === "semana" ? "default" : "outline"}
          onClick={() => setSelectedPeriod("semana")}
        >
          Esta Semana
        </Button>
        <Button
          variant={selectedPeriod === "mes" ? "default" : "outline"}
          onClick={() => setSelectedPeriod("mes")}
        >
          Este Mês
        </Button>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aulas Realizadas</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.totalAulas || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedPeriod === "hoje" ? "hoje" : selectedPeriod === "semana" ? "nesta semana" : "neste mês"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alunos Ativos</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.alunosAtivos || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.alunosAtivos === 1 ? "aluno participante" : "alunos participantes"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jornadas Ativas</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.jornadasAtivas || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.jornadasAtivas === 1 ? "jornada em andamento" : "jornadas em andamento"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engajamento</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : `${stats?.taxaConclusao || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              taxa de participação
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Próximas Aulas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Próximas Aulas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!proximasAulas || proximasAulas.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhuma aula agendada no momento.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {proximasAulas.map((aula) => {
                const { date, time } = formatDateTime(aula.data_inicio);
                return (
                  <div
                    key={aula.id}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <div className="flex flex-col items-center justify-center w-12 h-12 bg-primary/10 rounded-lg">
                        <span className="text-xs font-medium text-muted-foreground">{date.split(' ')[1]}</span>
                        <span className="text-lg font-bold text-primary">{date.split(' ')[0]}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{aula.tema || "Aula sem tema"}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{time}</span>
                          {aula.sala?.nome && (
                            <>
                              <span>•</span>
                              <span>{aula.sala.nome}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(aula.status)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="cursor-pointer hover:border-primary transition-colors">
          <Link to="/ensino?tab=agenda">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Aulas & Cronograma
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Visualize e gerencie o calendário de aulas
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <Link to="/jornadas">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="w-5 h-5" />
                Materiais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Acesse jornadas, cursos e conteúdos
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:border-primary transition-colors">
          <Link to="/ensino?tab=config">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5" />
                Configurações
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Gerencie salas e configurações de ensino
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
