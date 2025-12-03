import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, MessageCircle, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { subDays, differenceInDays } from "date-fns";

interface MemberAlert {
  id: string;
  nome: string;
  avatar_url: string | null;
  telefone: string | null;
  alertType: "ausencia" | "sentimento";
  alertReason: string;
  daysAbsent?: number;
  sentimento?: string;
}

export default function AtencaoPastoralWidget() {
  const [alerts, setAlerts] = useState<MemberAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      const today = new Date();
      const twentyOneDaysAgo = subDays(today, 21);
      const sevenDaysAgo = subDays(today, 7);

      // Get members with negative feelings in last 7 days
      const { data: sentimentosData } = await supabase
        .from("sentimentos_membros")
        .select(`
          pessoa_id,
          sentimento,
          data_registro,
          profiles:pessoa_id (
            id,
            nome,
            avatar_url,
            telefone
          )
        `)
        .in("sentimento", ["triste", "angustiado", "sozinho"])
        .gte("data_registro", sevenDaysAgo.toISOString())
        .order("data_registro", { ascending: false });

      // Get all active members
      const { data: membrosData } = await supabase
        .from("profiles")
        .select("id, nome, avatar_url, telefone")
        .eq("status", "membro");

      // Get attendance in last 21 days
      const { data: presencasData } = await supabase
        .from("presencas_culto")
        .select("pessoa_id, created_at")
        .gte("created_at", twentyOneDaysAgo.toISOString());

      const alertsList: MemberAlert[] = [];
      const addedIds = new Set<string>();

      // Add members with negative feelings
      sentimentosData?.forEach((s) => {
        const profile = s.profiles as any;
        if (profile && !addedIds.has(profile.id)) {
          const sentimentoLabel = 
            s.sentimento === "triste" ? "Triste" :
            s.sentimento === "angustiado" ? "Angustiado" :
            s.sentimento === "sozinho" ? "Sozinho" : s.sentimento;
          
          alertsList.push({
            id: profile.id,
            nome: profile.nome,
            avatar_url: profile.avatar_url,
            telefone: profile.telefone,
            alertType: "sentimento",
            alertReason: `Sentimento: ${sentimentoLabel}`,
            sentimento: s.sentimento,
          });
          addedIds.add(profile.id);
        }
      });

      // Find members absent for 21+ days
      const pessoasComPresenca = new Set(presencasData?.map((p) => p.pessoa_id) || []);
      
      membrosData?.forEach((membro) => {
        if (!pessoasComPresenca.has(membro.id) && !addedIds.has(membro.id)) {
          alertsList.push({
            id: membro.id,
            nome: membro.nome,
            avatar_url: membro.avatar_url,
            telefone: membro.telefone,
            alertType: "ausencia",
            alertReason: "Ausente há 21+ dias",
            daysAbsent: 21,
          });
          addedIds.add(membro.id);
        }
      });

      setAlerts(alertsList.slice(0, 5));
    } catch (error) {
      console.error("Erro ao carregar alertas:", error);
    } finally {
      setLoading(false);
    }
  };

  const openWhatsApp = (telefone: string | null, nome: string) => {
    if (!telefone) return;
    const cleanPhone = telefone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Oi ${nome.split(" ")[0]}, estava orando por você aqui... tudo bem?`
    );
    window.open(`https://wa.me/55${cleanPhone}?text=${message}`, "_blank");
  };

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardHeader className="p-4 md:p-6">
          <CardTitle className="text-lg md:text-xl flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Ovelhas que Precisam de Atenção
          </CardTitle>
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
      </CardHeader>
      <CardContent className="p-4 md:p-6 pt-0 space-y-3">
        {alerts.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-4">
            Nenhum alerta no momento. Parabéns!
          </p>
        ) : (
          <>
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
                  <Badge
                    variant={alert.alertType === "ausencia" ? "destructive" : "secondary"}
                    className={`text-xs mt-1 ${
                      alert.alertType === "sentimento"
                        ? "bg-amber-100 text-amber-800 hover:bg-amber-100"
                        : ""
                    }`}
                  >
                    {alert.alertReason}
                  </Badge>
                </div>

                {alert.telefone && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => openWhatsApp(alert.telefone, alert.nome)}
                    title="Enviar mensagem no WhatsApp"
                  >
                    <MessageCircle className="w-5 h-5" />
                  </Button>
                )}
              </div>
            ))}

            <Button
              variant="ghost"
              className="w-full mt-2 text-primary"
              onClick={() => navigate("/intercessao/sentimentos")}
            >
              Ver Todos
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
