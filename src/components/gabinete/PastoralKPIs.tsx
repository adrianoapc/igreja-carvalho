import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, Calendar, CheckCircle2 } from "lucide-react";
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

interface PastoralKPIsProps {
  atendimentos: AtendimentoPastoral[];
}

export function PastoralKPIs({ atendimentos }: PastoralKPIsProps) {
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

  const kpis = [
    {
      label: "Críticos Pendentes",
      value: criticos,
      icon: AlertTriangle,
      color: criticos > 0 ? "text-red-500" : "text-muted-foreground",
      bgColor: criticos > 0 ? "bg-red-500/10" : "bg-muted/50",
      alert: criticos > 0,
    },
    {
      label: "Alta Prioridade",
      value: altos,
      icon: Clock,
      color: altos > 0 ? "text-orange-500" : "text-muted-foreground",
      bgColor: altos > 0 ? "bg-orange-500/10" : "bg-muted/50",
      alert: false,
    },
    {
      label: "Agendados Hoje",
      value: agendadosHoje,
      icon: Calendar,
      color: agendadosHoje > 0 ? "text-blue-500" : "text-muted-foreground",
      bgColor: agendadosHoje > 0 ? "bg-blue-500/10" : "bg-muted/50",
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
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <Card
          key={kpi.label}
          className={cn(
            "transition-all",
            kpi.bgColor,
            kpi.alert && "ring-2 ring-red-500 animate-pulse"
          )}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("p-2 rounded-full", kpi.bgColor)}>
              <kpi.icon className={cn("h-5 w-5", kpi.color)} />
            </div>
            <div>
              <p className={cn("text-2xl font-bold", kpi.color)}>{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
