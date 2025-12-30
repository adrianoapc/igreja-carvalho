import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MessageCircle, Users, Heart, ArrowRight, Plus, Clock, MessageSquareHeart } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function Intercessao() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [stats, setStats] = useState({
    pedidosPendentes: 0,
    pedidosEmOracao: 0,
    intercessoresAtivos: 0,
    testemunhosPendentes: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Pedidos de oração
        const { data: pedidos } = await supabase
          .from("pedidos_oracao")
          .select("status");

        // Intercessores
        const { data: intercessores } = await supabase
          .from("intercessores")
          .select("ativo")
          .eq("ativo", true);

        // Testemunhos
        const { data: testemunhos } = await supabase
          .from("testemunhos")
          .select("publicar");

        setStats({
          pedidosPendentes: pedidos?.filter(p => p.status === "pendente").length || 0,
          pedidosEmOracao: pedidos?.filter(p => p.status === "em_oracao").length || 0,
          intercessoresAtivos: intercessores?.length || 0,
          testemunhosPendentes: testemunhos?.filter(t => !t.publicar).length || 0,
        });
      } catch (error) {
        console.error("Erro ao buscar estatísticas:", error);
      }
    };

    fetchStats();
  }, []);

  const modules = [
    {
      title: "Diário de Oração",
      description: "Seus pedidos de oração e testemunhos pessoais",
      icon: Heart,
      path: "/intercessao/diario",
      stats: [
        { label: "Pendentes", value: stats.pedidosPendentes, color: "text-accent-foreground" },
        { label: "Em Oração", value: stats.pedidosEmOracao, color: "text-primary" },
      ],
      color: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      title: "Sala de Guerra",
      description: "Área de trabalho dos intercessores - ore pela comunidade",
      icon: MessageSquareHeart,
      path: "/intercessao/sala-de-guerra",
      stats: [
        { label: "Ativos", value: stats.intercessoresAtivos, color: "text-green-600" },
      ],
      color: "bg-green-100 dark:bg-green-900/20",
      iconColor: "text-green-600",
    },
    {
      title: "Gestão de Equipes",
      description: "Configure intercessores e escalas de oração",
      icon: Users,
      path: "/intercessao/equipes",
      stats: [
        { label: "Testemunhos", value: stats.testemunhosPendentes, color: "text-accent-foreground" },
      ],
      color: "bg-accent/10",
      iconColor: "text-accent-foreground",
    },
    {
      title: "Sentimentos",
      description: "Acompanhe como os membros estão se sentindo",
      icon: Heart,
      path: "/intercessao/sentimentos",
      stats: [],
      color: "bg-pink-100 dark:bg-pink-900/20",
      iconColor: "text-pink-600",
    },
  ];

  const quickActions = [
    {
      title: "Novo Pedido de Oração",
      description: "Cadastrar novo pedido",
      icon: Plus,
      action: () => navigate("/intercessao/pedidos?novo=true"),
    },
    {
      title: "Alocar Pedidos Pendentes",
      description: "Distribuir automaticamente",
      icon: Clock,
      action: async () => {
        try {
          const { data: pedidosPendentes } = await supabase
            .from("pedidos_oracao")
            .select("id")
            .eq("status", "pendente");

          if (!pedidosPendentes || pedidosPendentes.length === 0) {
            toast({
              title: "Informação",
              description: "Não há pedidos pendentes para alocar",
            });
            return;
          }

          for (const pedido of pedidosPendentes) {
            await supabase.rpc("alocar_pedido_balanceado", {
              p_pedido_id: pedido.id
            });
          }

          toast({
            title: "Sucesso",
            description: `${pedidosPendentes.length} pedidos alocados automaticamente`,
          });

          window.location.reload();
        } catch (error) {
          console.error("Erro ao alocar pedidos:", error);
          toast({
            title: "Erro",
            description: "Não foi possível alocar os pedidos",
            variant: "destructive",
          });
        }
      },
    },
  ];

  return (
    <div className="space-y-4 md:space-y-6 p-2 sm:p-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Intercessão</h1>
        <p className="text-sm md:text-base text-muted-foreground mt-1">
          Gestão completa de intercessão, pedidos e testemunhos
        </p>
      </div>

      {/* Módulos principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {modules.map((module) => {
          const Icon = module.icon;
          return (
            <Card
              key={module.path}
              className="cursor-pointer transition-all hover:shadow-md hover:scale-105"
              onClick={() => navigate(module.path)}
            >
              <CardContent className="p-4 md:p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className={`p-3 rounded-lg ${module.color} flex-shrink-0`}>
                    <Icon className={`w-6 h-6 ${module.iconColor}`} />
                  </div>
                  <ArrowRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                </div>
                <h3 className="font-semibold text-base md:text-lg mb-1">{module.title}</h3>
                <p className="text-xs md:text-sm text-muted-foreground mb-3">
                  {module.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {module.stats.map((stat) => (
                    <div key={stat.label} className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{stat.label}:</span>
                      <Badge variant="outline" className={`text-xs ${stat.color}`}>
                        {stat.value}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Ações Rápidas */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.title}
                  variant="outline"
                  className="h-auto p-4 flex items-start gap-3 text-left"
                  onClick={action.action}
                >
                  <div className="p-2 rounded bg-primary/10 flex-shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{action.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {action.description}
                    </p>
                  </div>
                </Button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Atividade Recente */}
      <Card>
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-base md:text-lg">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent className="p-3 md:p-6 pt-0">
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">Nenhuma atividade recente</p>
            <p className="text-xs mt-1">
              As últimas ações de intercessão aparecerão aqui
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
