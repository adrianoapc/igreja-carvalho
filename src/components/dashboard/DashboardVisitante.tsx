import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Heart, MessageCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { WelcomeHeader } from "./WelcomeHeader";

export default function DashboardVisitante() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const firstName = profile?.nome?.split(" ")[0] || "Visitante";

  return (
    <div className="space-y-6 px-4 py-8">
      <WelcomeHeader />

      {/* Mensagem de Boas-Vindas */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center flex-shrink-0">
              <Heart className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-lg text-foreground mb-2">
                Seja bem-vindo(a) à Igreja Carvalho!
              </h3>
              <p className="text-muted-foreground text-sm mb-4">
                Ficamos muito felizes em ter você conosco. Esta é uma área especial onde você pode acessar informações sobre a igreja e interagir com a comunidade.
              </p>
              <p className="text-sm text-muted-foreground">
                💡 <strong>Dica:</strong> Para ter acesso completo ao sistema, entre em contato com nossa equipe para se tornar membro.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Ações Rápidas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Agenda de Eventos */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/30"
          onClick={() => navigate("/agenda")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Agenda de Eventos</p>
                <p className="text-sm text-muted-foreground">Veja nossos próximos cultos e eventos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Minha Família / Kids */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow border-2 hover:border-primary/30"
          onClick={() => navigate("/perfil/familia")}
        >
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-6 h-6 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">Minha Família</p>
                <p className="text-sm text-muted-foreground">Gerencie informações da sua família</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Card Informativo */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="font-semibold text-foreground mb-3">📍 Sobre Seu Acesso</h3>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Como <strong>visitante</strong>, você tem acesso limitado ao sistema. Você pode:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Ver a agenda de eventos e cultos</li>
              <li>Gerenciar informações da sua família</li>
              <li>Realizar check-in nos cultos</li>
            </ul>
            <p className="mt-4 pt-4 border-t">
              <strong>Quer ter acesso completo?</strong> Entre em contato com nossa equipe para iniciar seu processo de membresia.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Botão de Contato */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <MessageCircle className="w-5 h-5 text-primary" />
              <div>
                <p className="font-medium text-foreground">Precisa de ajuda?</p>
                <p className="text-sm text-muted-foreground">Fale com nossa equipe</p>
              </div>
            </div>
            <Button variant="outline" size="sm">
              Contato
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
