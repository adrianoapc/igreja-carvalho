import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Users } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import JornadaCard from "./JornadaCard";

interface KanbanColumnProps {
  id: string;
  title: string;
  items: Array<{
    id: string;
    pessoa_id: string;
    etapa_atual_id?: string | null;
    etapa_id?: string | null;
    responsavel_id?: string | null;
    created_at?: string;
    data_inscricao?: string;
    data_mudanca_fase?: string | null;
    concluido?: boolean;
    pessoa?: { nome: string; avatar_url?: string | null; telefone?: string | null } | null;
    profiles?: { nome: string; avatar_url?: string | null } | null;
    responsavel?: { id: string; nome: string; avatar_url?: string | null } | null;
    etapas_concluidas?: number;
    etapas_concluidas_ids?: string[];
  }>;
  totalEtapas: number;
  onRefetch: () => void;
  etapasOrdenadas: Array<{ id: string; ordem: number; titulo: string }>;
}

export default function KanbanColumn({
  id,
  title,
  items,
  totalEtapas,
  onRefetch,
  etapasOrdenadas,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${id}`,
  });

  return (
    <div className="w-[320px] shrink-0 flex flex-col max-h-full">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">
            {title}
          </h3>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full border bg-primary/10 text-primary border-primary/30">
            {items.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={`flex-1 rounded-xl border transition-colors overflow-hidden bg-slate-50 dark:bg-slate-900/20 ${
          isOver 
            ? "border-primary/30" 
            : "border-border/50"
        } ${isOver ? "bg-primary/5" : ""}`}
      >
        <ScrollArea className="h-full max-h-[calc(100vh-220px)]">
          <div className="p-3 w-full">
            <SortableContext
              items={items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              {items.length > 0 ? (
                <div className="space-y-2">
                  {items.map((inscricao) => (
                    <JornadaCard
                      key={inscricao.id}
                      inscricao={inscricao}
                      totalEtapas={totalEtapas}
                      onRefetch={onRefetch}
                      etapasOrdenadas={etapasOrdenadas}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-24 border-2 border-dashed border-muted-foreground/20 rounded-lg flex flex-col items-center justify-center text-muted-foreground/50">
                  <Users className="w-5 h-5 mb-1" />
                  <span className="text-xs">Arraste aqui</span>
                </div>
              )}
            </SortableContext>
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
