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

  const totalPendentes = atendimentos.filter(
    (a) => a.status !== "CONCLUIDO"
  ).length;

  const hasUrgent = criticos > 0;

  const kpis = [
    {
      label: "Críticos",
      value: criticos,
      icon: AlertTriangle,
      color: criticos > 0 ? "text-red-500" : "text-muted-foreground",
      bgColor: criticos > 0 ? "bg-red-500/10" : "bg-muted/30",
    },
    {
      label: "Alta",
      value: altos,
      icon: Clock,
      color: altos > 0 ? "text-orange-500" : "text-muted-foreground",
      bgColor: altos > 0 ? "bg-orange-500/10" : "bg-muted/30",
    },
    {
      label: "Hoje",
      value: agendadosHoje,
      icon: Calendar,
      color: agendadosHoje > 0 ? "text-blue-500" : "text-muted-foreground",
      bgColor: agendadosHoje > 0 ? "bg-blue-500/10" : "bg-muted/30",
    },
    {
      label: "Concluídos",
      value: concluidosSemana,
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
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
              {criticos} crítico{criticos > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2">
              {kpis.map((kpi) => (
                <div
                  key={kpi.label}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-lg",
                    kpi.bgColor
                  )}
                >
                  <kpi.icon className={cn("h-4 w-4 mb-1", kpi.color)} />
                  <span className={cn("text-lg font-bold", kpi.color)}>
                    {kpi.value}
                  </span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {kpi.label}
                  </span>
                </div>
              ))}
            </div>

            {totalPendentes > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                {totalPendentes} atendimento{totalPendentes > 1 ? "s" : ""} em aberto
              </p>
            )}
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs group"
          onClick={() => navigate("/gabinete")}
        >
          Acessar Gabinete
          <ArrowRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
        </Button>
      </CardContent>
    </Card>
  );
}
