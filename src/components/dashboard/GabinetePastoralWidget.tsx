import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Calendar, CheckCircle2, Users, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isToday, isThisWeek } from "date-fns";
import { cn } from "@/lib/utils";

type GravidadeEnum = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
type StatusEnum = "PENDENTE" | "TRIAGEM" | "AGENDADO" | "EM_ACOMPANHAMENTO" | "CONCLUIDO";

interface AtendimentoPastoral {
  id: string;
  created_at: string;
  gravidade: GravidadeEnum | null;
  status: StatusEnum | null;
  data_agendamento: string | null;
}

export function GabinetePastoralWidget() {
  const navigate = useNavigate();
  const [atendimentos, setAtendimentos] = useState<AtendimentoPastoral[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAtendimentos();
  }, []);

  const fetchAtendimentos = async () => {
    try {
      const { data, error } = await supabase
        .from("atendimentos_pastorais")
        .select("id, created_at, gravidade, status, data_agendamento");

      if (error) throw error;
      setAtendimentos((data as AtendimentoPastoral[]) || []);
    } catch (error) {
      console.error("Erro ao buscar atendimentos:", error);
    } finally {
      setLoading(false);
    }
  };

  const criticos = atendimentos.filter(
    (a) => a.gravidade === "CRITICA" && a.status !== "CONCLUIDO"
  ).length;

  const altos = atendimentos.filter(
    (a) => a.gravidade === "ALTA" && a.status !== "CONCLUIDO"
  ).length;

  const agendadosHoje = atendimentos.filter(
    (a) => a.data_agendamento && isToday(new Date(a.data_agendamento))
  ).length;

  const concluidosSemana = atendimentos.filter(
    (a) => a.status === "CONCLUIDO" && isThisWeek(new Date(a.created_at))
  ).length;

  const emAberto = atendimentos.filter(
    (a) => a.status !== "CONCLUIDO"
  ).length;

  const hasUrgent = criticos > 0;

  const kpis = [
    {
      label: "Casos Críticos",
      value: criticos,
      icon: AlertTriangle,
      color: criticos > 0 ? "text-red-500" : "text-muted-foreground",
      bgColor: criticos > 0 ? "bg-red-500/10" : "bg-muted/30",
      alert: criticos > 0,
    },
    {
      label: "Alta Prioridade",
      value: altos,
      icon: Clock,
      color: altos > 0 ? "text-orange-500" : "text-muted-foreground",
      bgColor: altos > 0 ? "bg-orange-500/10" : "bg-muted/30",
      alert: false,
    },
    {
      label: "Agendados Hoje",
      value: agendadosHoje,
      icon: Calendar,
      color: agendadosHoje > 0 ? "text-blue-500" : "text-muted-foreground",
      bgColor: agendadosHoje > 0 ? "bg-blue-500/10" : "bg-muted/30",
      alert: false,
    },
    {
      label: "Em Aberto",
      value: emAberto,
      icon: Users,
      color: emAberto > 0 ? "text-amber-500" : "text-muted-foreground",
      bgColor: emAberto > 0 ? "bg-amber-500/10" : "bg-muted/30",
      alert: false,
    },
    {
      label: "Concluídos (Semana)",
      value: concluidosSemana,
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      alert: false,
    },
  ];

  return (
    <Card className={cn(
      "shadow-soft transition-all",
      hasUrgent && "ring-2 ring-red-500/50"
    )}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            Gabinete Pastoral
          </CardTitle>
          {hasUrgent && (
            <Badge variant="destructive" className="animate-pulse text-xs">
              Atenção!
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-8 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1.5">
            {kpis.map((kpi) => (
              <div
                key={kpi.label}
                className={cn(
                  "flex items-center justify-between p-2 rounded-lg",
                  kpi.bgColor,
                  kpi.alert && "ring-1 ring-red-500/50"
                )}
              >
                <div className="flex items-center gap-2">
                  <kpi.icon className={cn("h-4 w-4", kpi.color)} />
                  <span className="text-sm text-foreground">{kpi.label}</span>
                </div>
                <span className={cn("text-lg font-bold", kpi.color)}>
                  {kpi.value}
                </span>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs group mt-2"
          onClick={() => navigate("/gabinete")}
        >
          Acessar Gabinete
          <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}
