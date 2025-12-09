import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Baby,
  Users,
  Clock,
  TrendingUp,
  Calendar,
  UserCheck,
  ArrowRight,
  QrCode,
  AlertCircle,
  Settings,
  BookOpen,
  HeartPulse,
  Smile,
  AlertTriangle,
  Heart,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function KidsDashboard() {
  const [selectedPeriod, setSelectedPeriod] = useState<"hoje" | "semana" | "mes">("hoje");

  // Query para estatísticas de check-ins
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["kids-stats", selectedPeriod],
    queryFn: async () => {
      try {
        const now = new Date();
        let startDate: Date;

        switch (selectedPeriod) {
          case "hoje":
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "semana":
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            startDate = new Date(weekStart.setHours(0, 0, 0, 0));
            break;
          case "mes":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        }

        // Total de crianças cadastradas
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: criancas, error: criancasError } = await (supabase as any)
          .from("profiles")
          .select("id")
          .eq("tipo_pessoa", "dependente") as { data: { id: string }[] | null; error: Error | null };

        if (criancasError) throw criancasError;

        const criancaIds = criancas?.map(c => c.id) || [];
        
        // Se não há crianças cadastradas, retornar valores zerados
        if (criancaIds.length === 0) {
          return {
            totalCriancas: 0,
            checkinsAtivos: 0,
            totalCheckins: 0,
            criancasUnicas: 0,
            frequenciaMedia: 0,
          };
        }

        // Presenças de crianças no período (via presencas_culto)
        const { data: presencas, error: presencasError } = await supabase
          .from("presencas_culto")
          .select("pessoa_id, culto_id, created_at")
          .in("pessoa_id", criancaIds)
          .gte("created_at", startDate.toISOString());

        if (presencasError) throw presencasError;

        // Crianças únicas que tiveram presença
        const criancasUnicas = new Set(presencas?.map((p) => p.pessoa_id) || []).size;
        
        // Crianças presentes AGORA (culto ativo)
        const { data: cultoAtivo } = await supabase
          .from("cultos")
          .select("id")
          .gte("data_culto", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
          .lte("data_culto", new Date().toISOString())
          .maybeSingle();

        let checkinsAtivos = 0;
        if (cultoAtivo) {
          const { data: presencasHoje } = await supabase
            .from("presencas_culto")
            .select("pessoa_id")
            .eq("culto_id", cultoAtivo.id)
            .in("pessoa_id", criancas?.map(c => c.id) || []);
          
          checkinsAtivos = presencasHoje?.length || 0;
        }

        // Frequência média
        const frequenciaMedia =
          criancas && criancas.length > 0
            ? Math.round((criancasUnicas / criancas.length) * 100)
            : 0;

        return {
          totalCheckins: presencas?.length || 0,
          checkinsAtivos,
          totalCriancas: criancas?.length || 0,
          frequenciaMedia,
          criancasUnicas,
        };
      } catch (error) {
        console.error("Erro ao carregar stats kids:", error);
        return {
          totalCriancas: 0,
          checkinsAtivos: 0,
          totalCheckins: 0,
          criancasUnicas: 0,
          frequenciaMedia: 0,
        };
      }
    },
    refetchInterval: 10000, // Atualiza a cada 10 segundos
  });

  // Query para últimos check-ins
  const { data: ultimosCheckins, isLoading: checkinsLoading } = useQuery({
    queryKey: ["kids-ultimos-checkins"],
    queryFn: async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: criancas } = await (supabase as any)
          .from("profiles")
          .select("id")
          .eq("tipo_pessoa", "dependente") as { data: { id: string }[] | null };

        if (!criancas || criancas.length === 0) return [];

        // Buscar presenças recentes de crianças
        const { data, error } = await supabase
          .from("presencas_culto")
          .select(`
            *,
            pessoa:profiles!presencas_culto_pessoa_id_fkey(id, nome, avatar_url),
            culto:cultos(id, titulo, data_culto)
          `)
          .in("pessoa_id", criancas.map(c => c.id))
          .order("created_at", { ascending: false })
          .limit(5);

        if (error) throw error;
        
        return (data || []).map(item => ({
          id: item.id,
          crianca_nome: item.pessoa?.nome || "Sem nome",
          crianca_avatar: item.pessoa?.avatar_url,
          checkin_at: item.created_at,
          culto_titulo: item.culto?.titulo || "Culto",
        }));
      } catch (error) {
        console.error("Erro ao carregar últimos check-ins kids:", error);
        return [];
      }
    },
    refetchInterval: 5000,
  });

  // Query para alergias e saúde
  const { data: healthStats } = useQuery({
    queryKey: ["kids-health-stats"],
    queryFn: async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: criancas, error } = await (supabase as any)
          .from("profiles")
          .select("id, alergias")
          .eq("tipo_pessoa", "dependente") as { data: Array<{ id: string; alergias: string | null }> | null; error: Error | null };

        if (error) throw error;

        const comAlergias = criancas?.filter(c => c.alergias && c.alergias.trim().length > 0).length || 0;

        return {
          totalComAlergias: comAlergias,
          percentualAlergias: criancas && criancas.length > 0 ? Math.round((comAlergias / criancas.length) * 100) : 0,
        };
      } catch (error) {
        console.error("Erro ao carregar health stats:", error);
        return { totalComAlergias: 0, percentualAlergias: 0 };
      }
    },
  });

  // Query para mood tracker (humor)
  const { data: moodStats } = useQuery({
    queryKey: ["kids-mood-stats", selectedPeriod],
    queryFn: async () => {
      try {
        const now = new Date();
        let startDate: Date;

        switch (selectedPeriod) {
          case "hoje":
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "semana":
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            startDate = new Date(weekStart.setHours(0, 0, 0, 0));
            break;
          case "mes":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        }

        const { data: diarios, error } = await supabase
          .from("kids_diario")
          .select("humor")
          .gte("created_at", startDate.toISOString());

        if (error) throw error;

        const humorCounts: Record<string, number> = {
          feliz: 0,
          triste: 0,
          agitado: 0,
          neutro: 0,
          choroso: 0,
          sonolento: 0,
        };

        diarios?.forEach(d => {
          if (d.humor && humorCounts.hasOwnProperty(d.humor)) {
            humorCounts[d.humor]++;
          }
        });

        const total = Object.values(humorCounts).reduce((a, b) => a + b, 0);
        const percentages = total === 0
          ? humorCounts
          : Object.entries(humorCounts).reduce((acc, [key, val]) => ({
              ...acc,
              [key]: Math.round((val / total) * 100)
            }), {} as Record<string, number>);

        return { counts: humorCounts, percentages };
      } catch (error) {
        console.error("Erro ao carregar mood stats:", error);
        return { counts: {}, percentages: {} };
      }
    },
  });

  // Query para alertas de comportamento (choro/agitação recorrente)
  const { data: behaviorAlerts } = useQuery({
    queryKey: ["kids-behavior-alerts", selectedPeriod],
    queryFn: async () => {
      try {
        const now = new Date();
        let startDate: Date;

        switch (selectedPeriod) {
          case "hoje":
            startDate = new Date(now.setHours(0, 0, 0, 0));
            break;
          case "semana":
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            startDate = new Date(weekStart.setHours(0, 0, 0, 0));
            break;
          case "mes":
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        }

        // Buscar diários com humor preocupante
        const { data: preocupantes, error } = await supabase
          .from("kids_diario")
          .select("crianca_id, humor, profiles:crianca_id(nome, avatar_url)")
          .gte("created_at", startDate.toISOString())
          .in("humor", ["choroso", "triste", "agitado"]);

        if (error) throw error;

        // Contar ocorrências por criança
        const childIssues: Record<string, { nome: string; avatar_url: string | null; count: number; moods: string[] }> = {};

        preocupantes?.forEach(record => {
          if (!childIssues[record.crianca_id]) {
            childIssues[record.crianca_id] = {
              nome: record.profiles?.nome || "Desconhecido",
              avatar_url: record.profiles?.avatar_url || null,
              count: 0,
              moods: [],
            };
          }
          childIssues[record.crianca_id].count++;
          if (record.humor && !childIssues[record.crianca_id].moods.includes(record.humor)) {
            childIssues[record.crianca_id].moods.push(record.humor);
          }
        });

        // Retornar os 5 principais
        return Object.entries(childIssues)
          .sort((a, b) => b[1].count - a[1].count)
          .slice(0, 5)
          .map(([id, data]) => ({ id, ...data }));
      } catch (error) {
        console.error("Erro ao carregar behavior alerts:", error);
        return [];
      }
    },
  });

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const now = new Date();
    const checkIn = new Date(dateString);
    const diffMs = now.getTime() - checkIn.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "Agora";
    if (diffMins < 60) return `${diffMins}min atrás`;
    const diffHours = Math.floor(diffMins / 60);
    return `${diffHours}h atrás`;
  };

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Baby className="w-8 h-8 text-primary" />
            Ministério Kids
          </h1>
          <p className="text-muted-foreground mt-1">
            Painel de controle e estatísticas
          </p>
        </div>

        <Link to="/kids/scanner">
          <Button size="lg" className="w-full sm:w-auto">
            <QrCode className="w-5 h-5 mr-2" />
            Abrir Totem
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
            <CardTitle className="text-sm font-medium">Na Sala Agora</CardTitle>
            <UserCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.checkinsAtivos || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.checkinsAtivos === 1 ? "criança presente" : "crianças presentes"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Check-ins {selectedPeriod === "hoje" ? "Hoje" : selectedPeriod === "semana" ? "na Semana" : "no Mês"}
            </CardTitle>
            <Clock className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.totalCheckins || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.criancasUnicas || 0} {stats?.criancasUnicas === 1 ? "criança única" : "crianças únicas"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Alergias</CardTitle>
            <HeartPulse className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {healthStats?.totalComAlergias || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {healthStats?.percentualAlergias || 0}% das crianças
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atenção Hoje</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {behaviorAlerts?.length || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {behaviorAlerts && behaviorAlerts.length > 0 ? "precisam de carinho" : "tudo bem com a turma"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Termômetro Emocional */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smile className="w-5 h-5 text-primary" />
            Termômetro Emocional da Turma
          </CardTitle>
          <p className="text-xs sm:text-sm text-muted-foreground mt-2">
            Distribuição de humor no período selecionado
          </p>
        </CardHeader>
        <CardContent>
          {moodStats && Object.keys(moodStats.percentages).length > 0 ? (
            <div className="space-y-4">
              {[
                { mood: "feliz", label: "Feliz", color: "bg-green-500", emoji: "😊" },
                { mood: "neutro", label: "Neutro", color: "bg-blue-500", emoji: "😐" },
                { mood: "agitado", label: "Agitado", color: "bg-yellow-500", emoji: "🤪" },
                { mood: "sonolento", label: "Sonolento", color: "bg-purple-500", emoji: "😴" },
                { mood: "triste", label: "Triste", color: "bg-indigo-500", emoji: "😔" },
                { mood: "choroso", label: "Choroso", color: "bg-red-500", emoji: "😢" },
              ].map(({ mood, label, color, emoji }) => {
                const percentage = (moodStats.percentages[mood] as number) || 0;
                return (
                  <div key={mood} className="space-y-1">
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-medium flex items-center gap-2">
                        <span>{emoji}</span> {label}
                      </span>
                      <span className="text-muted-foreground">
                        {percentage}% ({(moodStats.counts[mood] as number) || 0})
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                );
              })}
            </div>
          ) : (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum registro de humor no período.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Precisam de Carinho */}
      {behaviorAlerts && behaviorAlerts.length > 0 && (
        <Card className="border-l-4 border-l-red-500">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <Heart className="w-5 h-5 fill-red-600" />
              Precisam de Carinho Hoje
            </CardTitle>
            <p className="text-xs sm:text-sm text-muted-foreground mt-2">
              Crianças com sinais de tristeza, choro ou agitação recorrente
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {behaviorAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900"
                >
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarImage src={alert.avatar_url || undefined} />
                    <AvatarFallback className="bg-red-100 text-red-600">
                      <Baby className="w-5 h-5" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-red-900">{alert.nome}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {alert.moods.map((mood) => (
                        <Badge key={mood} variant="outline" className="text-xs bg-red-100 text-red-700 border-red-300">
                          {mood === "choroso" ? "😢 Choroso" : mood === "triste" ? "😔 Triste" : "🤪 Agitado"}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-red-600 mt-1">
                      {alert.count} {alert.count === 1 ? "ocorrência" : "ocorrências"} no período
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Últimos Check-ins */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Últimos Check-ins
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!ultimosCheckins || ultimosCheckins.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum check-in registrado no momento.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {ultimosCheckins.map((checkin) => (
                <div
                  key={checkin.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={checkin.crianca_avatar || undefined} />
                      <AvatarFallback className="bg-primary/10">
                        <Baby className="w-5 h-5 text-primary" />
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{checkin.crianca_nome}</p>
                      <p className="text-sm text-muted-foreground">
                        {checkin.culto_titulo}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {formatTime(checkin.checkin_at)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatRelativeTime(checkin.checkin_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações Rápidas */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all group">
          <Link to="/kids/scanner" className="block">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 shrink-0" />
                  Totem de Check-in
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Abrir o scanner QR Code para registrar entrada e saída de crianças
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all group">
          <Link to="/kids/turma-ativa" className="block">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 shrink-0" />
                  Diário de Classe
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Registrar observações e avaliações das crianças
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all group">
          <Link to="/kids" className="block">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                <div className="flex items-center gap-2">
                  <Baby className="w-5 h-5 shrink-0" />
                  Salas & Turmas
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Visualizar salas Kids e gerenciar turmas
              </p>
            </CardContent>
          </Link>
        </Card>

        <Card className="cursor-pointer hover:border-primary hover:shadow-md transition-all group">
          <Link to="/ensino?tab=config" className="block">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-base sm:text-lg">
                <div className="flex items-center gap-2">
                  <Settings className="w-5 h-5 shrink-0" />
                  Configurar Salas
                </div>
                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Criar e gerenciar salas do Ministério Kids
              </p>
            </CardContent>
          </Link>
        </Card>
      </div>
    </div>
  );
}
