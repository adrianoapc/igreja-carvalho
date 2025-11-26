import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MessageCircle, Heart, Calendar } from "lucide-react";
import { BannerDisplay } from "@/components/BannerDisplay";

const stats = [
  {
    title: "Total de Membros",
    value: "247",
    icon: Users,
    change: "+12 este mês",
    changeType: "positive" as const,
  },
  {
    title: "Pedidos de Oração",
    value: "18",
    icon: MessageCircle,
    change: "Aguardando resposta",
    changeType: "neutral" as const,
  },
  {
    title: "Testemunhos",
    value: "34",
    icon: Heart,
    change: "+5 esta semana",
    changeType: "positive" as const,
  },
  {
    title: "Próximos Cultos",
    value: "3",
    icon: Calendar,
    change: "Esta semana",
    changeType: "neutral" as const,
  },
];

const activeBanners = [
  {
    id: 1,
    title: "Culto Especial de Ação de Graças",
    message: "Junte-se a nós neste domingo para um culto especial de ação de graças. Teremos louvor, testemunhos e uma palavra poderosa!",
    type: "success" as const
  },
  {
    id: 2,
    title: "Atualização Sistema de Dízimos",
    message: "Nosso sistema de contribuições online está temporariamente indisponível. Use os envelopes físicos neste domingo.",
    type: "warning" as const
  }
];

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Visão geral da igreja</p>
      </div>

      <BannerDisplay banners={activeBanners} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="shadow-soft hover:shadow-medium transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Próximos Cultos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { day: "Domingo", date: "26 Nov", time: "10:00", type: "Culto de Celebração" },
              { day: "Quarta", date: "29 Nov", time: "19:30", type: "Culto de Oração" },
              { day: "Domingo", date: "3 Dez", time: "10:00", type: "Culto de Celebração" },
            ].map((culto, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-lg bg-secondary">
                <div>
                  <p className="font-medium text-foreground">{culto.type}</p>
                  <p className="text-sm text-muted-foreground">{culto.day}, {culto.date}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-primary">{culto.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { name: "Maria Silva", request: "Oração pela saúde da família", time: "Há 2 horas" },
              { name: "João Santos", request: "Agradecimento pela nova oportunidade", time: "Há 5 horas" },
              { name: "Ana Paula", request: "Oração pelos estudos", time: "Há 1 dia" },
            ].map((pedido, index) => (
              <div key={index} className="flex items-start gap-3 p-4 rounded-lg bg-secondary">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium">
                  {pedido.name.charAt(0)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{pedido.name}</p>
                  <p className="text-sm text-muted-foreground">{pedido.request}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pedido.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
