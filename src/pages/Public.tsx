import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Calendar, MessageSquare, BookOpen, Image, LogIn } from "lucide-react";
import BannerCarousel from "@/components/BannerCarousel";

export default function Public() {
  const navigate = useNavigate();

  const publicFeatures = [
    {
      icon: <Calendar className="w-8 h-8" />,
      title: "Agenda",
      description: "Veja os próximos cultos e eventos",
      available: false
    },
    {
      icon: <MessageSquare className="w-8 h-8" />,
      title: "Mensagens",
      description: "Ouça as últimas mensagens e pregações",
      available: false
    },
    {
      icon: <Image className="w-8 h-8" />,
      title: "Anúncios",
      description: "Fique por dentro dos avisos e novidades",
      available: true
    },
    {
      icon: <BookOpen className="w-8 h-8" />,
      title: "Bíblia",
      description: "Leia e estude a palavra de Deus",
      available: false
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            Bem-vindo à Nossa Igreja
          </h1>
          <p className="text-muted-foreground text-lg mb-6">
            Explore nossos recursos públicos ou faça login para acessar mais funcionalidades
          </p>
          <div className="flex gap-4 justify-center">
            <Button 
              onClick={() => navigate("/auth")}
              className="bg-gradient-primary shadow-soft"
              size="lg"
            >
              <LogIn className="w-5 h-5 mr-2" />
              Fazer Login / Cadastrar
            </Button>
            <Button 
              onClick={() => navigate("/first-admin")}
              variant="outline"
              size="lg"
            >
              Configurar Sistema
            </Button>
          </div>
        </div>

        {/* Banner Carousel */}
        <div className="mb-12">
          <BannerCarousel />
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {publicFeatures.map((feature, index) => (
            <Card key={index} className="shadow-soft hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="w-16 h-16 rounded-full bg-gradient-accent flex items-center justify-center mb-4 text-accent-foreground">
                  {feature.icon}
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">{feature.description}</p>
                {feature.available ? (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => navigate("/announcements")}
                  >
                    Acessar
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    Em breve
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <Card className="shadow-soft bg-secondary">
          <CardHeader>
            <CardTitle className="text-2xl">Seja um Membro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Como membro, você terá acesso a recursos exclusivos como:
            </p>
            <ul className="space-y-2 mb-6">
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Gestão de membros e visitantes</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Controle de kids e famílias</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Envio de pedidos de oração e testemunhos</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>Acesso a ensinamentos exclusivos</span>
              </li>
              <li className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span>E muito mais!</span>
              </li>
            </ul>
            <Button 
              onClick={() => navigate("/auth")}
              className="bg-gradient-primary"
            >
              Cadastrar como Membro
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
