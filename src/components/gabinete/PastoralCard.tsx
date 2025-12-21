import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, AlertTriangle } from "lucide-react";
import { format, differenceInHours } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

type GravidadeEnum = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";

interface AtendimentoPastoral {
  id: string;
  created_at: string;
  pessoa_id: string | null;
  visitante_id: string | null;
  origem: string | null;
  motivo_resumo: string | null;
  conteudo_original: string | null;
  gravidade: GravidadeEnum | null;
  status: string | null;
  pastor_responsavel_id: string | null;
  data_agendamento: string | null;
  local_atendimento: string | null;
  observacoes_internas: string | null;
  historico_evolucao: any[] | null;
  pessoa?: { nome: string | null; telefone: string | null } | null;
  visitante?: { nome: string | null; telefone: string | null } | null;
  pastor?: { nome: string | null } | null;
}

const GRAVIDADE_COLORS: Record<GravidadeEnum, string> = {
  BAIXA: "bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400",
  MEDIA: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  ALTA: "bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-400",
  CRITICA: "bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400",
};

const GRAVIDADE_LABELS: Record<GravidadeEnum, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

interface PastoralCardProps {
  atendimento: AtendimentoPastoral;
  onClick: () => void;
}

export function PastoralCard({ atendimento, onClick }: PastoralCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: atendimento.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const nome = atendimento.pessoa?.nome || atendimento.visitante?.nome || "Não identificado";
  const isCritico = atendimento.gravidade === "CRITICA";
  const isAlta = atendimento.gravidade === "ALTA";
  const isNovo = differenceInHours(new Date(), new Date(atendimento.created_at)) < 24;

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        "cursor-grab active:cursor-grabbing hover:shadow-md transition-all touch-manipulation max-w-full",
        isDragging && "opacity-50 shadow-lg scale-105",
        isCritico && "ring-2 ring-red-500 animate-pulse",
        isAlta && "ring-1 ring-orange-500"
      )}
    >
      <CardContent className="p-2.5 space-y-1.5 overflow-hidden">
        {/* Nome e Gravidade */}
        <div className="flex items-center justify-between gap-1 overflow-hidden">
          <div className="flex items-center gap-1 min-w-0 flex-1 overflow-hidden">
            {isCritico && (
              <AlertTriangle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
            )}
            <span className="font-medium text-xs truncate block">{nome}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {isNovo && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 bg-primary/20 text-primary">
                Novo
              </Badge>
            )}
            {atendimento.gravidade && (
              <Badge
                variant="outline"
                className={cn("text-[9px] px-1 py-0 h-4 whitespace-nowrap", GRAVIDADE_COLORS[atendimento.gravidade])}
              >
                {GRAVIDADE_LABELS[atendimento.gravidade]}
              </Badge>
            )}
          </div>
        </div>

        {/* Data e Agendamento compactos */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5 flex-shrink-0" />
            <span>{format(new Date(atendimento.created_at), "dd/MM", { locale: ptBR })}</span>
          </div>
          {atendimento.data_agendamento && (
            <div className="flex items-center gap-1 text-primary font-medium">
              <Calendar className="h-2.5 w-2.5 flex-shrink-0" />
              <span>{format(new Date(atendimento.data_agendamento), "dd/MM HH:mm", { locale: ptBR })}</span>
            </div>
          )}
        </div>

        {/* Motivo Resumo - apenas 1 linha */}
        {atendimento.motivo_resumo && (
          <p className="text-[10px] text-muted-foreground truncate block w-full">
            {atendimento.motivo_resumo}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
