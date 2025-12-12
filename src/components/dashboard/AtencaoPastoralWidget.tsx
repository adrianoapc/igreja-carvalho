import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, MessageCircle, ChevronRight, CalendarX, HeartCrack, PartyPopper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

interface OvelhaEmRisco {
  id: string;
  nome: string;
  avatar_url: string | null;
  telefone: string | null;
  tipo_risco: "ausencia" | "sentimento";
  detalhe: string;
  gravidade: number;
}

export default function AtencaoPastoralWidget() {
  const navigate = useNavigate();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["ovelhas-em-risco"],
    queryFn: async () => {
      // Verificar se está autenticado antes de chamar RPC
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.warn('Usuário não autenticado, pulando chamada RPC');
        return [];
      }

      const { data, error } = await supabase.rpc("get_ovelhas_em_risco");
      if (error) {
        console.error('Erro ao buscar ovelhas em risco:', error);
        return [];
      }
      return (data as OvelhaEmRisco[] || [])
        .sort((a, b) => b.gravidade - a.gravidade)
        .slice(0, 10);
    },
    retry: false,
  });

  const openWhatsApp = (telefone: string | null, nome: string, tipoRisco: string) => {
    if (!telefone) return;
    const cleanPhone = telefone.replace(/\D/g, "");
    const primeiroNome = nome.split(" ")[0];
    
    const message = tipoRisco === "ausencia"
      ? `Olá ${primeiroNome}, sentimos sua falta na igreja ultimamente! Está tudo bem com a família? 🙏`
      : `Olá ${primeiroNome}, vi seu pedido de oração... Deus está no controle! Posso te ligar rapidinho?`;
    
    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (isLoading) {
    return (
      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Ovelhas que Precisam de Atenção
          </CardTitle>
          <CardDescription>Monitoramento de ausências e sentimentos recentes</CardDescription>
        </CardHeader>
        <CardContent className="p-4 md:p-6 pt-0">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 bg-muted rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader className="p-4 md:p-6">
        <CardTitle className="text-lg md:text-xl flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-500" />
          Ovelhas que Precisam de Atenção
        </CardTitle>
        <CardDescription>Monitoramento de ausências e sentimentos recentes</CardDescription>
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0">
        {alerts.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <PartyPopper className="w-12 h-12 mx-auto text-green-500" />
            <p className="text-muted-foreground text-sm">
              Glória a Deus! Nenhuma ovelha em risco detectada hoje.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="max-h-[350px] overflow-y-auto space-y-3 pr-1">
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Avatar className="w-10 h-10 flex-shrink-0">
                    <AvatarImage src={alert.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm">
                      {getInitials(alert.nome)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-foreground truncate">
                      {alert.nome}
                    </p>
                    {alert.tipo_risco === "ausencia" ? (
                      <Badge variant="secondary" className="text-xs mt-1 gap-1">
                        <CalendarX className="w-3 h-3" />
                        {alert.detalhe}
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-xs mt-1 gap-1">
                        <HeartCrack className="w-3 h-3" />
                        {alert.detalhe}
                      </Badge>
                    )}
                  </div>

                  {alert.telefone && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="flex-shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                      onClick={() => openWhatsApp(alert.telefone, alert.nome, alert.tipo_risco)}
                      title="Enviar mensagem no WhatsApp"
                    >
                      <MessageCircle className="w-5 h-5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button
              variant="ghost"
              className="w-full mt-2 text-primary"
              onClick={() => navigate("/intercessao/sentimentos")}
            >
              Ver Todos
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
