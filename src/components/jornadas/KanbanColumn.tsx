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
    <div className="w-[320px] shrink-0 flex flex-col max-h-full">
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
        className={`flex-1 rounded-xl border transition-colors overflow-hidden ${
          isOver 
            ? "bg-primary/5 border-primary/30" 
            : "bg-muted/30 border-border/50"
        }`}
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
                      etapaIndex={etapaIndex}
                      onRefetch={onRefetch}
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
