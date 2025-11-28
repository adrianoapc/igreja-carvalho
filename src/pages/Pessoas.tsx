import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserPlus, UserCheck, TrendingUp, PhoneCall, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";

export default function Pessoas() {
  const navigate = useNavigate();
  const [stats, setStats] = useState([
    {
      title: "Total de Pessoas",
      value: "0",
      icon: Users,
      description: "Todas as pessoas cadastradas",
      color: "bg-primary/10 text-primary",
    },
    {
      title: "Visitantes",
      value: "0",
      icon: UserPlus,
      description: "Aguardando conversão",
      color: "bg-accent/10 text-accent-foreground",
      action: () => navigate("/visitantes"),
    },
    {
      title: "Frequentadores",
      value: "0",
      icon: UserCheck,
      description: "Com acesso ao app",
      color: "bg-secondary/10 text-secondary-foreground",
    },
    {
      title: "Membros",
      value: "0",
      icon: Users,
      description: "Membros ativos",
      color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400",
      action: () => navigate("/membros"),
    },
  ]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("status");

        if (error) throw error;

        const total = profiles?.length || 0;
        const visitantes = profiles?.filter((p) => p.status === "visitante").length || 0;
        const frequentadores = profiles?.filter((p) => p.status === "frequentador").length || 0;
        const membros = profiles?.filter((p) => p.status === "membro").length || 0;

        setStats((prev) => [
          { ...prev[0], value: total.toString() },
          { ...prev[1], value: visitantes.toString() },
          { ...prev[2], value: frequentadores.toString() },
          { ...prev[3], value: membros.toString() },
        ]);
      } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
      }
    };

    fetchStats();
  }, []);

  const quickActions = [
    {
      title: "Visitantes",
      description: "Gerenciar e promover visitantes",
      icon: UserPlus,
      path: "/visitantes",
      badge: "0 aguardando",
    },
    {
      title: "Membros",
      description: "Visualizar e editar perfis de membros",
      icon: Users,
      path: "/membros",
      badge: null,
    },
    {
      title: "Contatos Agendados",
      description: "Acompanhar contatos com visitantes",
      icon: PhoneCall,
      path: "/contatos",
      badge: "0 agendados",
    },
    {
      title: "Conversões",
      description: "Histórico de promoções de status",
      icon: TrendingUp,
      path: "#",
      badge: "Em breve",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Pessoas</h1>
        <p className="text-muted-foreground mt-1">
          Dashboard centralizado de gestão de pessoas
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className={`cursor-pointer transition-all hover:shadow-md ${
                stat.action ? "hover:scale-105" : ""
              }`}
              onClick={stat.action}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.title}</p>
                    <h3 className="text-2xl font-bold mt-1">{stat.value}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {stat.description}
                    </p>
                  </div>
                  <div className={`p-3 rounded-full ${stat.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Acesso Rápido</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <div
                  key={action.title}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border hover:bg-accent/50 cursor-pointer transition-colors"
                  onClick={() => action.path !== "#" && navigate(action.path)}
                >
                  <div className="p-3 rounded-full bg-primary/10">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{action.title}</h3>
                      {action.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {action.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <p>Nenhuma atividade recente</p>
            <p className="text-sm mt-1">
              As últimas interações com pessoas aparecerão aqui
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
