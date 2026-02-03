import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, FolderOpen } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import TarefaDialog from "@/components/projetos/TarefaDialog";
import { useFilialId } from "@/hooks/useFilialId";

interface Tarefa {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  prioridade: string;
  data_vencimento: string | null;
  responsavel_id: string | null;
  projeto_id: string | null;
  responsavel?: { id: string; nome: string; avatar_url: string | null };
}

interface Projeto {
  id: string;
  titulo: string;
}

const PRIORIDADE_CORES: { [key: string]: string } = {
  alta: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  media:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  baixa: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
};

export default function Backlog() {
  const navigate = useNavigate();
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: filialLoading,
  } = useFilialId();
  const [tarefaDialogOpen, setTarefaDialogOpen] = useState(false);
  const [tarefaEditando, setTarefaEditando] = useState<Tarefa | null>(null);
  const [tarefaSelecionada, setTarefaSelecionada] = useState<string | null>(
    null,
  );
  const [projetoDestino, setProjetoDestino] = useState<string | null>(null);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);

  const {
    data: tarefas,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["backlog-tarefas", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];

      const { data, error } = await supabase
        .from("tarefas")
        .select(
          `*, responsavel:profiles!tarefas_responsavel_id_fkey(id, nome, avatar_url)`,
        )
        .is("projeto_id", null)
        .eq("igreja_id", igrejaId)
        .eq("filial_id", filialId || "")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Tarefa[];
    },
    enabled: !!igrejaId && !!filialId,
  });

  const { data: projetos } = useQuery({
    queryKey: ["projetos-select", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];

      const response = await supabase
        .from("projetos")
        .select("id, titulo")
        .match({ ativo: true, igreja_id: igrejaId })
        .order("titulo");

      return (response.data || []) as Projeto[];
    },
    enabled: !!igrejaId,
  });

  const handleMoverTarefa = async () => {
    if (!tarefaSelecionada || !projetoDestino) return;
    try {
      const { error } = await supabase
        .from("tarefas")
        .update({ projeto_id: projetoDestino })
        .eq("id", tarefaSelecionada);
      if (error) throw error;
      toast.success("Tarefa movida para o projeto");
      refetch();
      setMostrarConfirmacao(false);
      setTarefaSelecionada(null);
      setProjetoDestino(null);
    } catch (error) {
      toast.error("Erro ao mover tarefa");
    }
  };

  const handleDeletarTarefa = async (tarefaId: string) => {
    try {
      const { error } = await supabase
        .from("tarefas")
        .delete()
        .eq("id", tarefaId);
      if (error) throw error;
      toast.success("Tarefa excluída");
      refetch();
    } catch (error) {
      toast.error("Erro ao excluir tarefa");
    }
  };

  const handleNovaTarefa = () => {
    setTarefaEditando(null);
    setTarefaDialogOpen(true);
  };

  const getPrioridadeVariant = (prioridade: string) => {
    switch (prioridade) {
      case "alta":
        return "destructive";
      case "media":
        return "secondary";
      case "baixa":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "todo":
        return "Não Iniciado";
      case "doing":
        return "Em Execução";
      case "done":
        return "Finalizado";
      case "cancelado":
        return "Cancelado";
      default:
        return status;
    }
  };

  if (filialLoading) {
    return <Skeleton className="h-96 w-full" />;
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="border-b bg-background px-4 py-3 md:px-6 md:py-4 space-y-3">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projetos")}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-foreground">
              Backlog Global
            </h1>
            <p className="text-sm text-muted-foreground">
              Tarefas não atribuídas a nenhum projeto
            </p>
          </div>
          <Button onClick={handleNovaTarefa} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Tarefa
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : !tarefas || tarefas.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center p-12">
              <FolderOpen className="h-16 w-16 text-muted-foreground mb-4 opacity-50" />
              <p className="text-lg font-semibold text-foreground mb-1">
                Backlog Vazio
              </p>
              <p className="text-sm text-muted-foreground text-center mb-6">
                Todas as tarefas foram atribuídas a projetos. Crie uma nova
                tarefa para começar.
              </p>
              <Button onClick={handleNovaTarefa} className="gap-2">
                <Plus className="h-4 w-4" />
                Primeira Tarefa
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3 max-w-4xl">
            {tarefas.map((tarefa) => (
              <Card
                key={tarefa.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="p-4">
                  <div className="flex flex-col gap-3">
                    {/* Título e Ações */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                          {tarefa.titulo}
                        </h3>
                        {tarefa.descricao && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {tarefa.descricao}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setTarefaEditando(tarefa);
                            setTarefaDialogOpen(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletarTarefa(tarefa.id)}
                          className="h-9 w-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Info Row 1: Prioridade, Status, Data Vencimento */}
                    <div className="flex flex-wrap gap-2 items-center">
                      <Badge variant={getPrioridadeVariant(tarefa.prioridade)}>
                        {tarefa.prioridade.charAt(0).toUpperCase() +
                          tarefa.prioridade.slice(1)}
                      </Badge>
                      <Badge variant="secondary">
                        {getStatusLabel(tarefa.status)}
                      </Badge>
                      {tarefa.data_vencimento && (
                        <Badge variant="outline" className="text-xs">
                          {format(
                            new Date(tarefa.data_vencimento),
                            "dd/MM/yyyy",
                            {
                              locale: ptBR,
                            },
                          )}
                        </Badge>
                      )}
                    </div>

                    {/* Info Row 2: Responsável e Botão Mover */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      {tarefa.responsavel ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage
                              src={tarefa.responsavel.avatar_url || ""}
                            />
                            <AvatarFallback className="text-xs">
                              {tarefa.responsavel.nome
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-muted-foreground">
                            {tarefa.responsavel.nome}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">
                          Sem responsável
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => {
                          setTarefaSelecionada(tarefa.id);
                          setMostrarConfirmacao(true);
                        }}
                      >
                        Mover para Projeto
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Dialog para criar/editar tarefa sem projeto */}
      <TarefaDialog
        open={tarefaDialogOpen}
        onOpenChange={setTarefaDialogOpen}
        projetoId=""
        tarefa={tarefaEditando}
        permitirSemProjeto
        onSuccess={() => {
          refetch();
          setTarefaDialogOpen(false);
          setTarefaEditando(null);
        }}
      />

      {/* Dialog para mover para projeto */}
      <AlertDialog
        open={mostrarConfirmacao}
        onOpenChange={setMostrarConfirmacao}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover tarefa para projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Selecione o projeto de destino para esta tarefa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Select
              value={projetoDestino || ""}
              onValueChange={setProjetoDestino}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um projeto" />
              </SelectTrigger>
              <SelectContent>
                {projetos?.map((projeto) => (
                  <SelectItem key={projeto.id} value={projeto.id}>
                    {projeto.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleMoverTarefa}
              disabled={!projetoDestino}
            >
              Mover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
