import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import TarefaCard from "./TarefaCard";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  data_vencimento: string | null;
  responsavel?: { id: string; nome: string; avatar_url: string | null };
}

interface KanbanTarefasColumnProps {
  id: string;
  titulo: string;
  cor: string;
  tarefas: Tarefa[];
  onEditarTarefa: (tarefa: Tarefa) => void;
}

export default function KanbanTarefasColumn({ id, titulo, cor, tarefas, onEditarTarefa }: KanbanTarefasColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`w-80 shrink-0 rounded-lg ${cor} ${isOver ? "ring-2 ring-primary" : ""}`}
    >
      <div className="p-3 border-b border-border/50">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-foreground">{titulo}</h3>
          <span className="text-xs text-muted-foreground bg-background/50 px-2 py-0.5 rounded-full">
            {tarefas.length}
          </span>
        </div>
      </div>

      <div className="p-2 space-y-2 min-h-[200px] max-h-[calc(100vh-280px)] overflow-y-auto">
        <SortableContext items={tarefas.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tarefas.map(tarefa => (
            <TarefaCard
              key={tarefa.id}
              tarefa={tarefa}
              onClick={() => onEditarTarefa(tarefa)}
            />
          ))}
        </SortableContext>

        {tarefas.length === 0 && (
          <div className="border-2 border-dashed border-border/50 rounded-lg p-4 text-center">
            <p className="text-xs text-muted-foreground">Arraste tarefas aqui</p>
          </div>
        )}
      </div>
    </div>
  );
}
