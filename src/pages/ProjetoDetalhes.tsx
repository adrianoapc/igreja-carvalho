import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Plus, Pencil, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { DndContext, closestCenter, DragEndEvent } from "@dnd-kit/core";
import { toast } from "sonner";
import KanbanTarefasColumn from "@/components/projetos/KanbanTarefasColumn";
import TarefaDialog from "@/components/projetos/TarefaDialog";
import ProjetoDialog from "@/components/projetos/ProjetoDialog";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  data_vencimento: string | null;
  responsavel_id: string | null;
  responsavel?: { id: string; nome: string; avatar_url: string | null };
}

interface Projeto {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  lider_id: string | null;
  lider?: { id: string; nome: string; avatar_url: string | null };
}

const COLUNAS = [
  { id: "todo", titulo: "Não Iniciado", cor: "bg-slate-100" },
  { id: "doing", titulo: "Em Execução", cor: "bg-blue-50" },
  { id: "done", titulo: "Finalizado", cor: "bg-green-50" },
];

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "ativo": return "default";
    case "concluido": return "secondary";
    case "pausado": return "outline";
    default: return "default";
  }
};

export default function ProjetoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tarefaDialogOpen, setTarefaDialogOpen] = useState(false);
  const [projetoDialogOpen, setProjetoDialogOpen] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);

  const { data: projeto, isLoading: loadingProjeto, refetch: refetchProjeto } = useQuery({
    queryKey: ["projeto", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("projetos")
        .select(`*, lider:profiles!projetos_lider_id_fkey(id, nome, avatar_url)`)
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as Projeto;
    },
    enabled: !!id,
  });

  const { data: tarefas, isLoading: loadingTarefas, refetch: refetchTarefas } = useQuery({
    queryKey: ["tarefas", id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("tarefas")
        .select(`*, responsavel:profiles!tarefas_responsavel_id_fkey(id, nome, avatar_url)`)
        .eq("projeto_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Tarefa[];
    },
    enabled: !!id,
  });

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const tarefaId = active.id as string;
    const novoStatus = over.id as string;

    const tarefa = tarefas?.find(t => t.id === tarefaId);
    if (!tarefa || tarefa.status === novoStatus) return;

    try {
      const { error } = await (supabase as any)
        .from("tarefas")
        .update({ status: novoStatus })
        .eq("id", tarefaId);

      if (error) throw error;
      toast.success("Status atualizado");
      refetchTarefas();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const handleEditarTarefa = (tarefa: Tarefa) => {
    setTarefaEditando(tarefa);
    setTarefaDialogOpen(true);
  };

  const handleNovaTarefa = () => {
    setTarefaEditando(null);
    setTarefaDialogOpen(true);
  };

  if (loadingProjeto) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!projeto) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Projeto não encontrado</p>
        <Button variant="outline" onClick={() => navigate("/projetos")} className="mt-4">
          Voltar para Projetos
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full max-w-full overflow-hidden relative flex flex-col">
      {/* Header */}
      <div className="shrink-0 z-10 relative p-4 border-b bg-background">
        <div className="flex items-center gap-4 mb-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projetos")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">{projeto.titulo}</h1>
              <Badge variant={statusBadgeVariant(projeto.status)}>{projeto.status}</Badge>
            </div>
            {projeto.descricao && (
              <p className="text-sm text-muted-foreground mt-1">{projeto.descricao}</p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={() => setProjetoDialogOpen(true)}>
            <Pencil className="w-4 h-4 mr-2" />
            Editar
          </Button>
          <Button size="sm" onClick={handleNovaTarefa}>
            <Plus className="w-4 h-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>

        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          {projeto.lider && (
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <span>Líder: {projeto.lider.nome}</span>
            </div>
          )}
          {projeto.data_fim && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Prazo: {format(new Date(projeto.data_fim), "dd/MM/yyyy", { locale: ptBR })}</span>
            </div>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto bg-muted/30 p-4">
        {loadingTarefas ? (
          <div className="flex gap-4 min-w-max">
            {COLUNAS.map(col => (
              <Skeleton key={col.id} className="w-80 h-96" />
            ))}
          </div>
        ) : (
          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <div className="flex gap-4 min-w-max">
              {COLUNAS.map(coluna => (
                <KanbanTarefasColumn
                  key={coluna.id}
                  id={coluna.id}
                  titulo={coluna.titulo}
                  cor={coluna.cor}
                  tarefas={tarefas?.filter(t => t.status === coluna.id) || []}
                  onEditarTarefa={handleEditarTarefa}
                />
              ))}
            </div>
          </DndContext>
        )}
      </div>

      <TarefaDialog
        open={tarefaDialogOpen}
        onOpenChange={setTarefaDialogOpen}
        projetoId={id!}
        tarefa={tarefaEditando}
        onSuccess={() => {
          refetchTarefas();
          setTarefaDialogOpen(false);
          setTarefaEditando(null);
        }}
      />

      <ProjetoDialog
        open={projetoDialogOpen}
        onOpenChange={setProjetoDialogOpen}
        projeto={projeto}
        onSuccess={() => {
          refetchProjeto();
          setProjetoDialogOpen(false);
        }}
      />
    </div>
  );
}
