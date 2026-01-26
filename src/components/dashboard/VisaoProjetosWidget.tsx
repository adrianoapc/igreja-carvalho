import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderKanban,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { useFilialId } from "@/hooks/useFilialId";

interface ProjetoComProgresso {
  id: string;
  titulo: string;
  total: number;
  concluidas: number;
  progresso: number;
}

export default function VisaoProjetosWidget() {
  const navigate = useNavigate();
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: filialLoading,
  } = useFilialId();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["projetos-stats", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId)
        return { tarefasAtrasadas: 0, projetosAtivos: 0, topProjetos: [] };

      // Buscar tarefas atrasadas (não concluídas e vencidas)
      const hoje = new Date().toISOString().split("T")[0];
      let tarefasQuery = supabase
        .from("tarefas")
        .select("*", { count: "exact", head: true })
        .eq("igreja_id", igrejaId)
        .neq("status", "done")
        .lt("data_vencimento", hoje);
      if (!isAllFiliais && filialId) {
        tarefasQuery = tarefasQuery.eq("filial_id", filialId);
      }
      const { count: atrasadas } = await tarefasQuery;

      // Buscar projetos ativos
      let projetosCountQuery = supabase
        .from("projetos")
        .select("*", { count: "exact", head: true })
        .eq("igreja_id", igrejaId)
        .eq("status", "ativo");
      if (!isAllFiliais && filialId) {
        projetosCountQuery = projetosCountQuery.eq("filial_id", filialId);
      }
      const { count: projetosAtivos } = await projetosCountQuery;

      // Buscar top 3 projetos com progresso
      let projetosQuery = supabase
        .from("projetos")
        .select(`id, titulo, tarefas(status)`)
        .eq("igreja_id", igrejaId)
        .eq("status", "ativo")
        .limit(5);
      if (!isAllFiliais && filialId) {
        projetosQuery = projetosQuery.eq("filial_id", filialId);
      }
      const { data: projetos } = await projetosQuery;

      const projetosComProgresso: ProjetoComProgresso[] = (projetos || [])
        .map((p) => {
          const tarefas =
            (p as { tarefas?: { status: string }[] }).tarefas || [];
          const total = tarefas.length;
          const concluidas = tarefas.filter((t) => t.status === "done").length;
          return {
            id: p.id,
            titulo: p.titulo,
            total,
            concluidas,
            progresso: total > 0 ? Math.round((concluidas / total) * 100) : 0,
          };
        })
        .sort((a, b) => b.total - a.total)
        .slice(0, 3);

      return {
        tarefasAtrasadas: atrasadas || 0,
        projetosAtivos: projetosAtivos || 0,
        topProjetos: projetosComProgresso,
      };
    },
    enabled: !filialLoading && !!igrejaId,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-primary" />
          Visão de Projetos
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate("/projetos")}>
          Ver todos
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-3">
          <div
            className={`p-3 rounded-lg ${stats?.tarefasAtrasadas ? "bg-destructive/10" : "bg-muted/50"}`}
          >
            <div className="flex items-center gap-2">
              <AlertTriangle
                className={`w-4 h-4 ${stats?.tarefasAtrasadas ? "text-destructive" : "text-muted-foreground"}`}
              />
              <span className="text-xs text-muted-foreground">
                Tarefas Atrasadas
              </span>
            </div>
            <p
              className={`text-2xl font-bold mt-1 ${stats?.tarefasAtrasadas ? "text-destructive" : "text-foreground"}`}
            >
              {stats?.tarefasAtrasadas || 0}
            </p>
          </div>

          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">
                Projetos Ativos
              </span>
            </div>
            <p className="text-2xl font-bold mt-1 text-foreground">
              {stats?.projetosAtivos || 0}
            </p>
          </div>
        </div>

        {/* Top Projetos */}
        {stats?.topProjetos && stats.topProjetos.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase">
              Top Projetos
            </h4>
            {stats.topProjetos.map((projeto) => (
              <div
                key={projeto.id}
                className="p-2 rounded-lg bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/projetos/${projeto.id}`)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-foreground truncate">
                    {projeto.titulo}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {projeto.progresso}%
                  </span>
                </div>
                <Progress value={projeto.progresso} className="h-1.5" />
              </div>
            ))}
          </div>
        )}

        {(!stats?.topProjetos || stats.topProjetos.length === 0) && (
          <div className="text-center py-4 text-muted-foreground">
            <p className="text-sm">Nenhum projeto ativo</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
