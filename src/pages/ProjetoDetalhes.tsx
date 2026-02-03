import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    case "ativo":
      return "default";
    case "concluido":
      return "secondary";
    case "pausado":
      return "outline";
    case "cancelado":
      return "destructive";
    default:
      return "default";
  }
};

export default function ProjetoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tarefaDialogOpen, setTarefaDialogOpen] = useState(false);
  const [projetoDialogOpen, setProjetoDialogOpen] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);
  const [showNormalizeDialog, setShowNormalizeDialog] = useState(false);

  const {
    data: projeto,
    isLoading: loadingProjeto,
    refetch: refetchProjeto,
  } = useQuery({
    queryKey: ["projeto", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projetos")
        .select(
          `*, lider:profiles!projetos_lider_id_fkey(id, nome, avatar_url)`,
        )
        .eq("id", id)
        .single();
      if (error) {
        console.error("Erro ao carregar projeto:", error);
        return null;
      }
      return data as Projeto;
    },
    enabled: !!id,
  });

  const {
    data: tarefas,
    isLoading: loadingTarefas,
    refetch: refetchTarefas,
  } = useQuery({
    queryKey: ["tarefas", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tarefas")
        .select(
          `*, responsavel:profiles!tarefas_responsavel_id_fkey(id, nome, avatar_url)`,
        )
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
    const colunaIds = COLUNAS.map((coluna) => coluna.id);
    const overId = over.id as string;
    const novoStatus = colunaIds.includes(overId)
      ? overId
      : tarefas?.find((t) => t.id === overId)?.status;

    const tarefa = tarefas?.find((t) => t.id === tarefaId);
    if (!tarefa || !novoStatus || tarefa.status === novoStatus) return;

    try {
      const { error } = await supabase
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

  const tarefasSemColuna =
    tarefas?.filter((t) => !COLUNAS.some((c) => c.id === t.status)) || [];

  useEffect(() => {
    if (tarefasSemColuna.length === 0 || !id) return;
    const storageKey = `normalizePrompted:${id}`;
    if (sessionStorage.getItem(storageKey) === "true") return;
    setShowNormalizeDialog(true);
    sessionStorage.setItem(storageKey, "true");
  }, [tarefasSemColuna.length, id]);

  const handleMoverParaColuna = async (tarefaId: string, status: string) => {
    try {
      const { error } = await supabase
        .from("tarefas")
        .update({ status })
        .eq("id", tarefaId);
      if (error) throw error;
      toast.success("Tarefa movida para o kanban");
      refetchTarefas();
    } catch (error) {
      toast.error("Erro ao mover tarefa");
    }
  };

  const handleNormalizarStatus = async () => {
    if (tarefasSemColuna.length === 0) return;
    try {
      const ids = tarefasSemColuna.map((tarefa) => tarefa.id);
      const { error } = await supabase
        .from("tarefas")
        .update({ status: "todo" })
        .in("id", ids);
      if (error) throw error;
      toast.success("Status normalizados para 'Não Iniciado'");
      refetchTarefas();
    } catch (error) {
      toast.error("Erro ao normalizar status");
    }
  };

  const totalTarefas = tarefas?.length || 0;
  const tarefasConcluidas =
    tarefas?.filter((t) => t.status === "done").length || 0;
  const tarefasAtrasadas =
    tarefas?.filter(
      (t) =>
        t.data_vencimento &&
        new Date(t.data_vencimento) < new Date() &&
        t.status !== "done",
    ).length || 0;
  const taxaConclusao =
    totalTarefas > 0 ? (tarefasConcluidas / totalTarefas) * 100 : 0;

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
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
        <Button
          variant="outline"
          onClick={() => navigate("/projetos")}
          className="mt-4"
        >
          Voltar para Projetos
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] w-full max-w-full overflow-hidden relative flex flex-col">
      {/* Header */}
      <div className="shrink-0 z-10 relative p-4 border-b bg-background">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/projetos")}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <h1 className="text-xl font-bold text-foreground truncate">
                  {projeto.titulo}
                </h1>
                <Badge variant={statusBadgeVariant(projeto.status)}>
                  {projeto.status}
                </Badge>
              </div>
              {projeto.descricao && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                  {projeto.descricao}
                </p>
              )}
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span>{totalTarefas} tarefas</span>
                <span className="flex items-center gap-1 text-foreground font-semibold">
                  Conclusão: {taxaConclusao.toFixed(0)}%
                </span>
                {tarefasAtrasadas > 0 && (
                  <span className="flex items-center gap-1 text-destructive font-semibold">
                    Atrasadas: {tarefasAtrasadas}
                  </span>
                )}
                {projeto.data_fim && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(projeto.data_fim), "dd/MM/yyyy", {
                      locale: ptBR,
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {projeto.lider && (
              <Avatar className="h-9 w-9 border-2 border-primary/60">
                <AvatarImage src={projeto.lider.avatar_url || undefined} />
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                  {getInitials(projeto.lider.nome)}
                </AvatarFallback>
              </Avatar>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setProjetoDialogOpen(true)}
            >
              <Pencil className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Editar</span>
            </Button>
            <Button size="sm" onClick={handleNovaTarefa}>
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Nova Tarefa</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto bg-muted/30 p-4 space-y-4">
        {loadingTarefas ? (
          <div className="flex gap-4 min-w-max">
            {COLUNAS.map((col) => (
              <Skeleton key={col.id} className="w-80 h-96" />
            ))}
          </div>
        ) : (
          <>
            <DndContext
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <div className="flex gap-4 min-w-max">
                {COLUNAS.map((coluna) => (
                  <KanbanTarefasColumn
                    key={coluna.id}
                    id={coluna.id}
                    titulo={coluna.titulo}
                    cor={coluna.cor}
                    tarefas={
                      tarefas?.filter((t) => t.status === coluna.id) || []
                    }
                    onEditarTarefa={handleEditarTarefa}
                  />
                ))}
              </div>
            </DndContext>

            {tarefasSemColuna.length > 0 && (
              <div className="rounded-lg border bg-amber-50/60 dark:bg-amber-950/20 p-4">
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                    Tarefas fora do Kanban
                  </h3>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                    Encontramos {tarefasSemColuna.length} tarefa(s) com status
                    não mapeado. Você pode movê-las para uma coluna.
                  </p>
                </div>
                <div className="mt-3">
                  <Button variant="outline" onClick={handleNormalizarStatus}>
                    Normalizar tudo para Não Iniciado
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {tarefasSemColuna.map((tarefa) => (
                    <div
                      key={tarefa.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md bg-white/80 dark:bg-background/40 p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{tarefa.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          Status atual: {tarefa.status || "(vazio)"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleMoverParaColuna(tarefa.id, "todo")
                          }
                        >
                          Mover para Não Iniciado
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditarTarefa(tarefa)}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tarefasSemColuna.length > 0 && (
              <div className="rounded-lg border bg-amber-50/60 dark:bg-amber-950/20 p-4">
                <div>
                  <h3 className="font-semibold text-amber-800 dark:text-amber-200">
                    Tarefas fora do Kanban
                  </h3>
                  <p className="text-sm text-amber-700/80 dark:text-amber-300/80">
                    Encontramos {tarefasSemColuna.length} tarefa(s) com status
                    não mapeado. Você pode movê-las para uma coluna.
                  </p>
                </div>
                <div className="mt-3">
                  <Button variant="outline" onClick={handleNormalizarStatus}>
                    Normalizar tudo para Não Iniciado
                  </Button>
                </div>
                <div className="mt-3 space-y-2">
                  {tarefasSemColuna.map((tarefa) => (
                    <div
                      key={tarefa.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-md bg-white/80 dark:bg-background/40 p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{tarefa.titulo}</p>
                        <p className="text-xs text-muted-foreground">
                          Status atual: {tarefa.status || "(vazio)"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleMoverParaColuna(tarefa.id, "todo")
                          }
                        >
                          Mover para Não Iniciado
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditarTarefa(tarefa)}
                        >
                          Editar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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

      <AlertDialog
        open={showNormalizeDialog}
        onOpenChange={setShowNormalizeDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Normalizar tarefas?</AlertDialogTitle>
            <AlertDialogDescription>
              Encontramos {tarefasSemColuna.length} tarefa(s) com status fora do
              Kanban. Deseja mover todas para "Não Iniciado" agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Agora não</AlertDialogCancel>
            <AlertDialogAction onClick={handleNormalizarStatus}>
              Normalizar tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
