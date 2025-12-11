import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { format, isPast, isToday, differenceInCalendarDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Flag } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";


interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  data_vencimento: string | null;
  responsavel?: { id: string; nome: string; avatar_url: string | null };
}

interface TarefaCardProps {
  tarefa: Tarefa;
  onClick: () => void;
}

export default function TarefaCard({ tarefa, onClick }: TarefaCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tarefa.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const prioridadeCor = {
    alta: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    media: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    baixa: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  };

  const isOverdue = tarefa.data_vencimento && isPast(new Date(tarefa.data_vencimento)) && !isToday(new Date(tarefa.data_vencimento));
  const isDueToday = tarefa.data_vencimento && isToday(new Date(tarefa.data_vencimento));
  
  const diasAteVencimento = tarefa.data_vencimento
    ? differenceInCalendarDays(new Date(tarefa.data_vencimento), new Date())
    : null;

  const alertaPrazo =
    isOverdue
      ? { label: `⚠️ Atrasada ${Math.abs(diasAteVencimento || 0)}d`, variant: "destructive" as const }
      : isDueToday
        ? { label: "Vence Hoje!", variant: "destructive" as const }
        : diasAteVencimento !== null && diasAteVencimento <= 3 && diasAteVencimento >= 0
          ? { label: "Atenção", variant: "warning" as const }
          : null;

  // WhatsApp link removed - telefone not available in responsavel object

  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={onClick}
      className={`group w-full p-3 cursor-grab active:cursor-grabbing transition-all bg-card border shadow-sm hover:shadow-md hover:border-primary/30 relative ${
        isDragging ? "opacity-50 shadow-lg ring-2 ring-primary rotate-1 z-10" : ""
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="space-y-2">
        <p className="font-medium text-sm leading-tight line-clamp-2">{tarefa.titulo}</p>

        {tarefa.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2">{tarefa.descricao}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="secondary"
              className={`text-[10px] px-1.5 py-0 h-5 ${prioridadeCor[tarefa.prioridade as keyof typeof prioridadeCor] || ""}`}
            >
              <Flag className="w-2.5 h-2.5 mr-0.5" />
              {tarefa.prioridade}
            </Badge>

            {alertaPrazo ? (
              <Badge
                variant={alertaPrazo.variant === "destructive" ? "destructive" : "secondary"}
                className="text-[10px] px-1.5 py-0 h-5"
              >
                {alertaPrazo.label}
              </Badge>
            ) : tarefa.data_vencimento ? (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                <Calendar className="w-2.5 h-2.5 mr-0.5" />
                {format(new Date(tarefa.data_vencimento), "dd/MM", { locale: ptBR })}
              </Badge>
            ) : null}
          </div>

          {tarefa.responsavel && (
            <Avatar
              className={`h-8 w-8 border-2 ${
                isOverdue
                  ? "border-red-400/70"
                  : isDueToday
                    ? "border-orange-400/70"
                    : "border-primary/60"
              }`}
            >
              <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                {getInitials(tarefa.responsavel.nome)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      </div>
    </Card>
  );
}
