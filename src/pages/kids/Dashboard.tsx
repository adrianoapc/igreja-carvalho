import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

        // Total de crianças cadastradas (sem filtro deleted_at para evitar erro em schemas sem coluna)
        const { data: criancas, error: criancasError } = await supabase
          .from("profiles")
          .select("id")
          .eq("tipo_pessoa", "dependente");

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
        // Buscar crianças
        const { data: criancas } = await supabase
          .from("profiles")
          .select("id")
          .eq("tipo_pessoa", "dependente");

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
            <CardTitle className="text-sm font-medium">Total Cadastrado</CardTitle>
            <Users className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : stats?.totalCriancas || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.totalCriancas === 1 ? "criança cadastrada" : "crianças cadastradas"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frequência Média</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? "..." : `${stats?.frequenciaMedia || 0}%`}
            </div>
            <p className="text-xs text-muted-foreground">
              do total cadastrado
            </p>
          </CardContent>
        </Card>
      </div>

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
