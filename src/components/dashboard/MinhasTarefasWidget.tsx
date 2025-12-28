import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckSquare, Calendar, ChevronRight, AlertTriangle } from "lucide-react";
import { format, isPast, isToday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Tarefa {
  id: string;
  titulo: string;
  prioridade: string;
  data_vencimento: string | null;
  projeto: { id: string; titulo: string } | null;
}

const prioridadeConfig: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-slate-100 text-slate-700" },
  media: { label: "Média", className: "bg-amber-100 text-amber-700" },
  alta: { label: "Alta", className: "bg-red-100 text-red-700" },
};

export default function MinhasTarefasWidget() {
  const navigate = useNavigate();
  const { profile } = useAuth();

  const { data: tarefas, isLoading } = useQuery({
    queryKey: ["minhas-tarefas", profile?.id],
    queryFn: async () => {
      if (!profile?.id) return [];

      const { data, error } = await supabase
        .from("tarefas")
        .select(`
          id, titulo, prioridade, data_vencimento,
          projeto:projetos(id, titulo)
        `)
        .eq("responsavel_id", profile.id)
        .neq("status", "done")
        .order("data_vencimento", { ascending: true, nullsFirst: false })
        .limit(3);

      if (error) throw error;
      return data as Tarefa[];
    },
    enabled: !!profile?.id,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-primary" />
          Minhas Tarefas
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate("/projetos")}>
          Ver todas
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </CardHeader>
      <CardContent>
        {tarefas && tarefas.length > 0 ? (
          <div className="space-y-3">
            {tarefas.map(tarefa => {
              const isAtrasada = tarefa.data_vencimento && 
                isPast(new Date(tarefa.data_vencimento)) && 
                !isToday(new Date(tarefa.data_vencimento));
              const config = prioridadeConfig[tarefa.prioridade] || prioridadeConfig.media;

              return (
                <div
                  key={tarefa.id}
                  className={`p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors ${
                    isAtrasada ? "border-destructive bg-destructive/5" : "bg-background"
                  }`}
                  onClick={() => tarefa.projeto && navigate(`/projetos/${tarefa.projeto.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground truncate">{tarefa.titulo}</h4>
                      {tarefa.projeto && (
                        <p className="text-xs text-muted-foreground truncate">{tarefa.projeto.titulo}</p>
                      )}
                    </div>
                    <Badge className={`shrink-0 text-xs ${config.className}`}>{config.label}</Badge>
                  </div>
                  {tarefa.data_vencimento && (
                    <div className={`flex items-center gap-1 mt-2 text-xs ${
                      isAtrasada ? "text-destructive font-medium" : "text-muted-foreground"
                    }`}>
                      {isAtrasada && <AlertTriangle className="w-3 h-3" />}
                      <Calendar className="w-3 h-3" />
                      <span>{format(new Date(tarefa.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nenhuma tarefa pendente</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
