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
        "cursor-grab active:cursor-grabbing hover:shadow-md transition-all touch-manipulation",
        isDragging && "opacity-50 shadow-lg scale-105",
        isCritico && "ring-2 ring-red-500 animate-pulse",
        isAlta && "ring-1 ring-orange-500"
      )}
    >
      <CardContent className="p-3 space-y-2">
        {/* Nome, Badge Novo e Gravidade */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isCritico && (
              <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 animate-bounce" />
            )}
            <span className="font-medium text-sm truncate">{nome}</span>
            {isNovo && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-primary/20 text-primary shrink-0">
                Novo
              </Badge>
            )}
          </div>
          {atendimento.gravidade && (
            <Badge
              variant="outline"
              className={cn("text-xs shrink-0", GRAVIDADE_COLORS[atendimento.gravidade])}
            >
              {GRAVIDADE_LABELS[atendimento.gravidade]}
            </Badge>
          )}
        </div>

        {/* Data de Criação */}
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {format(new Date(atendimento.created_at), "dd/MM/yyyy", { locale: ptBR })}
        </div>

        {/* Motivo Resumo */}
        {atendimento.motivo_resumo && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {atendimento.motivo_resumo}
          </p>
        )}

        {/* Data de Agendamento */}
        {atendimento.data_agendamento && (
          <div className="flex items-center gap-1 text-xs text-primary font-medium">
            <Calendar className="h-3 w-3" />
            {format(new Date(atendimento.data_agendamento), "dd/MM 'às' HH:mm", { locale: ptBR })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
