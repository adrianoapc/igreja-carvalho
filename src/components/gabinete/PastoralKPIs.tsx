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

  const pendentes = atendimentos.filter(
    (a) => a.status === "PENDENTE"
  ).length;

  const agendadosHoje = atendimentos.filter(
    (a) => a.data_agendamento && isToday(new Date(a.data_agendamento))
  ).length;

  const concluidosSemana = atendimentos.filter(
    (a) => a.status === "CONCLUIDO" && isThisWeek(new Date(a.created_at))
  ).length;

  const kpis = [
    {
      label: "Críticos",
      value: criticos,
      icon: AlertTriangle,
      color: criticos > 0 ? "text-destructive" : "text-muted-foreground",
      bgColor: criticos > 0 ? "bg-destructive/10" : "bg-muted/50",
      alert: criticos > 0,
    },
    {
      label: "Pendentes",
      value: pendentes,
      icon: Clock,
      color: pendentes > 0 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground",
      bgColor: pendentes > 0 ? "bg-amber-500/10" : "bg-muted/50",
      alert: false,
    },
    {
      label: "Hoje",
      value: agendadosHoje,
      icon: Calendar,
      color: agendadosHoje > 0 ? "text-primary" : "text-muted-foreground",
      bgColor: agendadosHoje > 0 ? "bg-primary/10" : "bg-muted/50",
      alert: false,
    },
    {
      label: "Concluídos",
      value: concluidosSemana,
      icon: CheckCircle2,
      color: "text-emerald-600 dark:text-emerald-400",
      bgColor: "bg-emerald-500/10",
      alert: false,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {kpis.map((kpi) => (
        <div
          key={kpi.label}
          className={cn(
            "flex flex-col items-center justify-center p-2.5 rounded-lg transition-all",
            kpi.bgColor,
            kpi.alert && "ring-1 ring-destructive"
          )}
        >
          <kpi.icon className={cn("h-4 w-4 mb-1", kpi.color)} />
          <span className={cn("text-lg font-bold leading-none", kpi.color)}>
            {kpi.value}
          </span>
          <span className="text-[10px] text-muted-foreground mt-0.5 text-center leading-tight">
            {kpi.label}
          </span>
        </div>
      ))}
    </div>
  );
}
