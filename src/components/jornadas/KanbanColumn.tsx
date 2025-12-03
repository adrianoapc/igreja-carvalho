import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Users } from "lucide-react";
import JornadaCard from "./JornadaCard";

interface KanbanColumnProps {
  id: string;
  title: string;
  items: any[];
  totalEtapas: number;
  etapaIndex: number;
  onRefetch: () => void;
}

export default function KanbanColumn({
  id,
  title,
  items,
  totalEtapas,
  etapaIndex,
  onRefetch,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${id}`,
  });

  return (
    <div className="w-80 flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {title}
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {items.length}
          </span>
        </div>
      </div>

      {/* Column Content */}
      <div
        ref={setNodeRef}
        className={`min-h-[500px] rounded-xl p-2 transition-colors ${
          isOver 
            ? "bg-primary/5 ring-2 ring-primary/20" 
            : "bg-muted/40"
        }`}
      >
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
                  etapaIndex={etapaIndex}
                  onRefetch={onRefetch}
                />
              ))}
            </div>
          ) : (
            <div className="h-32 border-2 border-dashed border-muted-foreground/20 rounded-lg flex flex-col items-center justify-center text-muted-foreground/50">
              <Users className="w-6 h-6 mb-2" />
              <span className="text-xs">Arraste aqui</span>
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
