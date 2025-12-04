import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar, AlertTriangle } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

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

const prioridadeConfig: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-slate-100 text-slate-700" },
  media: { label: "Média", className: "bg-amber-100 text-amber-700" },
  alta: { label: "Alta", className: "bg-red-100 text-red-700" },
};

export default function TarefaCard({ tarefa, onClick }: TarefaCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: tarefa.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getInitials = (name: string) => {
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  const isAtrasada = tarefa.data_vencimento && 
    isPast(new Date(tarefa.data_vencimento)) && 
    !isToday(new Date(tarefa.data_vencimento)) &&
    tarefa.status !== "done";

  const isHoje = tarefa.data_vencimento && isToday(new Date(tarefa.data_vencimento));

  const config = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`cursor-grab active:cursor-grabbing bg-card shadow-sm hover:shadow-md transition-shadow w-full ${
        isAtrasada ? "border-destructive border-2" : ""
      }`}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        {/* Adicionado items-start para alinhar ao topo se o texto quebrar */}
        <div className="flex items-start justify-between gap-2">
          {/* CORREÇÃO AQUI: break-words, text-left e line-clamp-3 para não estourar */}
          <h4 className="font-medium text-sm text-foreground leading-tight break-words text-left line-clamp-3">
            {tarefa.titulo}
          </h4>
          <Badge className={`shrink-0 text-xs ${config.className}`}>{config.label}</Badge>
        </div>

        {tarefa.descricao && (
          <p className="text-xs text-muted-foreground line-clamp-2 break-words text-left">
            {tarefa.descricao}
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          {/* Responsável */}
          {tarefa.responsavel ? (
            <Avatar className="w-6 h-6 shrink-0">
              <AvatarImage src={tarefa.responsavel.avatar_url || undefined} />
              <AvatarFallback className="text-[10px]">{getInitials(tarefa.responsavel.nome)}</AvatarFallback>
            </Avatar>
          ) : <div className="w-6 h-6" />} {/* Spacer se não tiver responsavel */}

          {/* Data vencimento */}
          {tarefa.data_vencimento && (
            <div className={`flex items-center gap-1 text-xs shrink-0 ${
              isAtrasada ? "text-destructive font-medium" : isHoje ? "text-amber-600" : "text-muted-foreground"
            }`}>
              {isAtrasada && <AlertTriangle className="w-3 h-3" />}
              <Calendar className="w-3 h-3" />
              <span>{format(new Date(tarefa.data_vencimento), "dd/MM", { locale: ptBR })}</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}