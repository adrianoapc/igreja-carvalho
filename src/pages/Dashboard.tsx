import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, MessageCircle, Heart, Calendar } from "lucide-react";
import { BannerDisplay } from "@/components/BannerDisplay";
import RegistrarSentimentoDialog from "@/components/sentimentos/RegistrarSentimentoDialog";
import AtencaoPastoralWidget from "@/components/dashboard/AtencaoPastoralWidget";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

const stats = [{
  title: "Total de Membros",
  value: "247",
  icon: Users,
  change: "+12 este mês",
  changeType: "positive" as const
}, {
  title: "Pedidos de Oração",
  value: "18",
  icon: MessageCircle,
  change: "Aguardando resposta",
  changeType: "neutral" as const
}, {
  title: "Testemunhos",
  value: "34",
  icon: Heart,
  change: "+5 esta semana",
  changeType: "positive" as const
}, {
  title: "Próximos Cultos",
  value: "3",
  icon: Calendar,
  change: "Esta semana",
  changeType: "neutral" as const
}];

const activeBanners = [{
  id: 1,
  title: "Culto Especial de Ação de Graças",
  message: "Junte-se a nós neste domingo para um culto especial de ação de graças. Teremos louvor, testemunhos e uma palavra poderosa!",
  type: "success" as const
}, {
  id: 2,
  title: "Atualização Sistema de Dízimos",
  message: "Nosso sistema de contribuições online está temporariamente indisponível. Use os envelopes físicos neste domingo.",
  type: "warning" as const
}];

export default function Dashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [sentimentoDialogOpen, setSentimentoDialogOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('sentimento') === 'true') {
      setSentimentoDialogOpen(true);
      searchParams.delete('sentimento');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams]);

  return (
    <div className="space-y-4 md:space-y-6 lg:space-y-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">Visão geral da igreja</p>
        </div>
        <Button onClick={() => setSentimentoDialogOpen(true)} className="flex items-center gap-2">
          <Heart className="w-4 h-4" />
          <span className="hidden sm:inline">Como você está?</span>
        </Button>
      </div>

      <RegistrarSentimentoDialog open={sentimentoDialogOpen} onOpenChange={setSentimentoDialogOpen} />

      <BannerDisplay banners={activeBanners} />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-6">
        {stats.map(stat => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="shadow-soft hover:shadow-medium transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2 p-4 md:p-6">
                <CardTitle className="text-xs md:text-sm font-medium text-muted-foreground">
                  {stat.title}
                </CardTitle>
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-gradient-primary flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 md:w-5 md:h-5 text-primary-foreground" />
                </div>
              </CardHeader>
              <CardContent className="p-4 md:p-6 pt-0">
                <div className="text-2xl md:text-3xl font-bold text-foreground">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 lg:gap-6">
        <Card className="shadow-soft">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl">Próximos Cultos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-0">
            {[{
              day: "Domingo",
              date: "26 Nov",
              time: "10:00",
              type: "Culto de Celebração"
            }, {
              day: "Quarta",
              date: "29 Nov",
              time: "19:30",
              type: "Culto de Oração"
            }, {
              day: "Domingo",
              date: "3 Dez",
              time: "10:00",
              type: "Culto de Celebração"
            }].map((culto, index) => (
              <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 md:p-4 rounded-lg gap-2 sm:gap-0 bg-muted/50">
                <div>
                  <p className="font-medium text-sm md:text-base text-foreground">{culto.type}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">{culto.day}, {culto.date}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-xs md:text-sm font-medium text-primary">{culto.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="p-4 md:p-6">
            <CardTitle className="text-lg md:text-xl">Pedidos Recentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-0">
            {[{
              name: "Maria Silva",
              request: "Oração pela saúde da família",
              time: "Há 2 horas"
            }, {
              name: "João Santos",
              request: "Agradecimento pela nova oportunidade",
              time: "Há 5 horas"
            }, {
              name: "Ana Paula",
              request: "Oração pelos estudos",
              time: "Há 1 dia"
            }].map((pedido, index) => (
              <div key={index} className="flex items-start gap-2 md:gap-3 p-3 md:p-4 rounded-lg bg-muted/50">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium text-sm md:text-base flex-shrink-0">
                  {pedido.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm md:text-base text-foreground truncate">{pedido.name}</p>
                  <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">{pedido.request}</p>
                  <p className="text-xs text-muted-foreground mt-1">{pedido.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <AtencaoPastoralWidget />
      </div>
    </div>
  );
}
