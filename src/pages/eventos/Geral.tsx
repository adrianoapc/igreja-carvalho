import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Calendar, Users, Music, Clock, BarChart3, Image } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function CultosGeral() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    proximosCultos: 0,
    timesAtivos: 0,
    membrosEscalados: 0,
    cultosRealizados: 0,
    midiasAtivas: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const today = new Date().toISOString().split("T")[0];
    const startOfDay = `${today}T00:00:00Z`;

    // Buscar cultos futuros/atuais primeiro para usar os IDs na contagem de escalas
    const { data: cultosFuturos, count: countCultos } = await supabase
      .from("eventos")
      .select("id", { count: "exact" })
      .gte("data_evento", startOfDay)
      .in("status", ["planejado", "confirmado"]);

    const cultosIds = (cultosFuturos || []).map((c) => c.id);

    const [times, escalas, realizados, midias] = await Promise.all([
      supabase
        .from("times")
        .select("id", { count: "exact" })
        .eq("ativo", true),
      cultosIds.length === 0
        ? Promise.resolve({ count: 0 })
        : supabase
            .from("escalas")
            .select("id", { count: "exact" })
            .in("evento_id", cultosIds),
      supabase
        .from("eventos")
        .select("id", { count: "exact" })
        .eq("status", "realizado"),
      supabase
        .from("midias")
        .select("id", { count: "exact" })
        .eq("ativo", true)
    ]);

    setStats({
      proximosCultos: countCultos || 0,
      timesAtivos: times.count || 0,
      membrosEscalados: escalas.count || 0,
      cultosRealizados: realizados.count || 0,
      midiasAtivas: midias.count || 0
    });
  };

  const modules = [
    {
      title: "Eventos",
      description: "Gerenciar cultos e eventos programados",
      icon: Calendar,
      path: "/cultos/eventos",
      stats: [{ label: "Próximos", value: stats.proximosCultos }]
    },
    {
      title: "Times",
      description: "Gerenciar equipes e departamentos",
      icon: Users,
      path: "/cultos/times",
      stats: [{ label: "Times Ativos", value: stats.timesAtivos }]
    },
    {
      title: "Dashboard Liturgia",
      description: "Estatísticas e análise de participação",
      icon: BarChart3,
      path: "/cultos/liturgia-dashboard",
      stats: [{ label: "Cultos", value: stats.cultosRealizados }]
    },
    {
      title: "Mídias",
      description: "Gerenciar conteúdo visual e comunicação",
      icon: Image,
      path: "/cultos/midias",
      stats: [{ label: "Mídias Ativas", value: stats.midiasAtivas }]
    }
  ];

  const quickActions = [
    {
      title: "Novo Culto/Evento",
      description: "Criar novo culto ou evento",
      icon: Plus,
      action: () => navigate("/cultos/eventos?novo=true")
    },
    {
      title: "Gerenciar Times",
      description: "Adicionar ou editar times",
      icon: Users,
      action: () => navigate("/cultos/times")
    },
    {
      title: "Ver Dashboard Liturgia",
      description: "Estatísticas de participação",
      icon: BarChart3,
      action: () => navigate("/cultos/liturgia-dashboard")
    },
    {
      title: "Gerenciar Mídias",
      description: "Adicionar ou editar mídias",
      icon: Image,
      action: () => navigate("/cultos/midias")
    }
  ];

  return (
    <div className="space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Cultos e Eventos</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Gerencie cultos, eventos, times e escalas
        </p>
      </div>

      {/* Estatísticas Rápidas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Calendar className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Próximos Cultos</p>
                <p className="text-xl md:text-2xl font-bold">{stats.proximosCultos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Users className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Times Ativos</p>
                <p className="text-xl md:text-2xl font-bold">{stats.timesAtivos}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Music className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Membros Escalados</p>
                <p className="text-xl md:text-2xl font-bold">{stats.membrosEscalados}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-6">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Clock className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-xs md:text-sm text-muted-foreground">Realizados</p>
                <p className="text-xl md:text-2xl font-bold">{stats.cultosRealizados}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Módulos Principais */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Módulos Principais</h2>
        <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
          {modules.map((module) => (
            <Card
              key={module.path}
              className="cursor-pointer hover:shadow-medium transition-shadow"
              onClick={() => navigate(module.path)}
            >
              <CardHeader className="p-4 md:p-6">
                <div className="flex items-start gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                    <module.icon className="w-5 h-5 md:w-6 md:h-6 text-primary-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base md:text-lg">{module.title}</CardTitle>
                    <p className="text-xs md:text-sm text-muted-foreground mt-1">
                      {module.description}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="flex flex-wrap gap-3 md:gap-4">
                  {module.stats.map((stat) => (
                    <div key={stat.label}>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                      <p className="text-lg md:text-xl font-bold">{stat.value}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Ações Rápidas */}
      <div>
        <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Ações Rápidas</h2>
        <div className="grid gap-3 md:gap-4 sm:grid-cols-2">
          {quickActions.map((action) => (
            <Card
              key={action.title}
              className="cursor-pointer hover:shadow-medium transition-shadow"
              onClick={action.action}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
                    <action.icon className="w-5 h-5 md:w-6 md:h-6 text-accent-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm md:text-base">{action.title}</h3>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
