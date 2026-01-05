import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Plus, FolderKanban } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ProjetoCard from "@/components/projetos/ProjetoCard";
import ProjetoDialog from "@/components/projetos/ProjetoDialog";
import { useFilialId } from "@/hooks/useFilialId";

interface Projeto {
  id: string;
  titulo: string;
  descricao: string | null;
  status: string;
  data_inicio: string | null;
  data_fim: string | null;
  lider_id: string | null;
  lider?: { id: string; nome: string; avatar_url: string | null };
  tarefas?: { status: string }[];
}

export default function Projetos() {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { igrejaId, filialId, isAllFiliais, loading: filialLoading } = useFilialId();

  const { data: projetos, isLoading, refetch } = useQuery({
    queryKey: ["projetos", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("projetos")
        .select(`
          *,
          lider:profiles!projetos_lider_id_fkey(id, nome, avatar_url),
          tarefas(status)
        `)
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Erro ao carregar projetos:", error);
        return [];
      }
      return data as Projeto[];
    },
    enabled: !filialLoading && !!igrejaId,
  });

  const calcularProgresso = (tarefas: { status: string }[] | undefined) => {
    if (!tarefas || tarefas.length === 0) return 0;
    const concluidas = tarefas.filter(t => t.status === "done").length;
    return Math.round((concluidas / tarefas.length) * 100);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Projetos</h1>
          <p className="text-muted-foreground text-sm">Gerencie seus projetos e tarefas</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Projeto
        </Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : projetos && projetos.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetos.map(projeto => (
            <ProjetoCard
              key={projeto.id}
              projeto={projeto}
              progresso={calcularProgresso(projeto.tarefas)}
              totalTarefas={projeto.tarefas?.length || 0}
              tarefasConcluidas={projeto.tarefas?.filter(t => t.status === "done").length || 0}
              onClick={() => navigate(`/projetos/${projeto.id}`)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-muted/30 rounded-lg border border-dashed">
          <FolderKanban className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-medium text-foreground mb-2">Nenhum projeto encontrado</h3>
          <p className="text-sm text-muted-foreground mb-4">Crie seu primeiro projeto para começar</p>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Projeto
          </Button>
        </div>
      )}

      <ProjetoDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          refetch();
          setDialogOpen(false);
        }}
      />
    </div>
  );
}
