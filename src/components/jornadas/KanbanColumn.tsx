import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import JornadaCard from "./JornadaCard";

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  items: any[];
  totalEtapas: number;
  etapaIndex: number;
  onRefetch: () => void;
}

export default function KanbanColumn({
  id,
  title,
  color,
  items,
  totalEtapas,
  etapaIndex,
  onRefetch,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: `column-${id}`,
  });

  return (
    <Card
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 transition-colors ${
        isOver ? "bg-muted/50 ring-2 ring-primary" : ""
      }`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-xs">
            {items.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="min-h-[400px]">
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
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
        </SortableContext>
      </CardContent>
    </Card>
  );
}
