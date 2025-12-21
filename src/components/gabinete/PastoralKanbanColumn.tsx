import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PastoralCard } from "./PastoralCard";
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

interface PastoralKanbanColumnProps {
  status: string;
  label: string;
  icon: React.ReactNode;
  atendimentos: AtendimentoPastoral[];
  onCardClick: (atendimento: AtendimentoPastoral) => void;
}

export function PastoralKanbanColumn({
  status,
  label,
  icon,
  atendimentos,
  onCardClick,
}: PastoralKanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  // Ordenar por gravidade (críticos primeiro)
  const sortedAtendimentos = [...atendimentos].sort((a, b) => {
    const order: Record<GravidadeEnum, number> = {
      CRITICA: 0,
      ALTA: 1,
      MEDIA: 2,
      BAIXA: 3,
    };
    const aOrder = a.gravidade ? order[a.gravidade] : 4;
    const bOrder = b.gravidade ? order[b.gravidade] : 4;
    return aOrder - bOrder;
  });

  const hasCriticos = atendimentos.some((a) => a.gravidade === "CRITICA");

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        "bg-muted/20 transition-all min-h-[300px] overflow-hidden",
        isOver && "ring-2 ring-primary bg-primary/5",
        hasCriticos && status === "PENDENTE" && "border-destructive/50"
      )}
    >
      <CardHeader className="p-3 pb-2">
        <CardTitle className="text-xs font-medium flex items-center gap-1.5">
          {icon}
          <span className="truncate">{label}</span>
          <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5">
            {atendimentos.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-2 pt-0 overflow-hidden">
        <ScrollArea className="h-[calc(100vh-420px)] min-h-[200px]">
          <SortableContext
            items={sortedAtendimentos.map((a) => a.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2 pr-1">
              {sortedAtendimentos.map((atendimento) => (
                <div key={atendimento.id} className="w-full overflow-hidden">
                  <PastoralCard
                    atendimento={atendimento}
                    onClick={() => onCardClick(atendimento)}
                  />
                </div>
              ))}

              {atendimentos.length === 0 && (
                <div className="text-center py-6 text-muted-foreground text-xs border border-dashed border-muted rounded-lg">
                  <p>Nenhum</p>
                </div>
              )}
            </div>
          </SortableContext>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
