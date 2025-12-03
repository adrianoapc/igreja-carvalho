import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Calendar, CheckCircle2, Users, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface MembroChamada {
  pessoa_id: string;
  nome: string;
  avatar_url: string | null;
  nome_grupo: string;
  tipo_grupo: string;
  ja_marcado: boolean;
}

interface Culto {
  id: string;
  titulo: string;
  data_culto: string;
}

export default function Chamada() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [optimisticStates, setOptimisticStates] = useState<Record<string, boolean>>({});

  // Buscar culto mais próximo (hoje ou mais recente)
  const { data: culto, isLoading: loadingCulto } = useQuery({
    queryKey: ["culto-hoje"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      
      // Primeiro tenta buscar culto de hoje
      const { data: cultoHoje, error: errorHoje } = await supabase
        .from("cultos")
        .select("id, titulo, data_culto")
        .gte("data_culto", `${hoje}T00:00:00`)
        .lte("data_culto", `${hoje}T23:59:59`)
        .order("data_culto", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (errorHoje) throw errorHoje;
      if (cultoHoje) return cultoHoje as Culto;

      // Se não houver culto hoje, busca o mais recente
      const { data: cultoRecente, error: errorRecente } = await supabase
        .from("cultos")
        .select("id, titulo, data_culto")
        .lt("data_culto", `${hoje}T00:00:00`)
        .order("data_culto", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorRecente) throw errorRecente;
      return cultoRecente as Culto | null;
    },
  });

  // Buscar lista de chamada
  const { data: membros, isLoading: loadingMembros } = useQuery({
    queryKey: ["lista-chamada", culto?.id],
    queryFn: async () => {
      if (!culto?.id) return [];
      
      const { data, error } = await supabase.rpc("get_minha_lista_chamada", {
        p_culto_id: culto.id,
      });

      if (error) throw error;
      return (data as MembroChamada[]) || [];
    },
    enabled: !!culto?.id,
  });

  // Buscar user_id atual
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Mutation para marcar presença
  const marcarPresenca = useMutation({
    mutationFn: async ({ pessoaId, marcar }: { pessoaId: string; marcar: boolean }) => {
      if (!culto?.id || !currentUser?.id) throw new Error("Dados incompletos");

      if (marcar) {
        const { error } = await supabase.from("presencas_culto").insert({
          culto_id: culto.id,
          pessoa_id: pessoaId,
          metodo: "lider_celula",
          validado_por: currentUser.id,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("presencas_culto")
          .delete()
          .eq("culto_id", culto.id)
          .eq("pessoa_id", pessoaId);
        if (error) throw error;
      }
    },
    onMutate: async ({ pessoaId, marcar }) => {
      // Optimistic update
      setOptimisticStates((prev) => ({ ...prev, [pessoaId]: marcar }));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lista-chamada", culto?.id] });
    },
    onError: (error, { pessoaId }) => {
      // Reverter estado otimista
      setOptimisticStates((prev) => {
        const newState = { ...prev };
        delete newState[pessoaId];
        return newState;
      });
      toast.error("Erro ao registrar presença", {
        description: "Tente novamente em alguns segundos.",
      });
      console.error("Erro:", error);
    },
    onSettled: (_, __, { pessoaId }) => {
      // Limpar estado otimista após conclusão
      setTimeout(() => {
        setOptimisticStates((prev) => {
          const newState = { ...prev };
          delete newState[pessoaId];
          return newState;
        });
      }, 500);
    },
  });

  // Agrupar membros por grupo
  const membrosAgrupados = useMemo(() => {
    if (!membros) return {};
    return membros.reduce((acc, membro) => {
      const grupo = membro.nome_grupo || "Outros";
      if (!acc[grupo]) acc[grupo] = [];
      acc[grupo].push(membro);
      return acc;
    }, {} as Record<string, MembroChamada[]>);
  }, [membros]);

  // Calcular progresso
  const { presentes, total, porcentagem } = useMemo(() => {
    if (!membros) return { presentes: 0, total: 0, porcentagem: 0 };
    const total = membros.length;
    const presentes = membros.filter((m) => {
      const isOptimistic = optimisticStates[m.pessoa_id];
      return isOptimistic !== undefined ? isOptimistic : m.ja_marcado;
    }).length;
    return { presentes, total, porcentagem: total > 0 ? (presentes / total) * 100 : 0 };
  }, [membros, optimisticStates]);

  // Estado efetivo (considerando otimismo)
  const getEstadoEfetivo = (membro: MembroChamada) => {
    if (optimisticStates[membro.pessoa_id] !== undefined) {
      return optimisticStates[membro.pessoa_id];
    }
    return membro.ja_marcado;
  };

  const handleToggle = (pessoaId: string, marcado: boolean) => {
    marcarPresenca.mutate({ pessoaId, marcar: !marcado });
  };

  if (loadingCulto) {
    return (
      <div className="min-h-screen p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!culto) {
    return (
      <div className="min-h-screen p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nenhum culto encontrado</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Não há cultos agendados para hoje ou recentemente.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dataCulto = new Date(culto.data_culto);
  const isHoje = new Date().toDateString() === dataCulto.toDateString();

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 border-b">
        <div className="p-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-2">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="w-4 h-4 text-primary" />
                <Badge variant={isHoje ? "default" : "secondary"}>
                  {isHoje ? "Hoje" : format(dataCulto, "dd/MM/yyyy", { locale: ptBR })}
                </Badge>
              </div>
              <h1 className="text-xl font-bold truncate">{culto.titulo}</h1>
              <p className="text-sm text-muted-foreground">
                {format(dataCulto, "EEEE, HH:mm", { locale: ptBR })}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Users className="w-4 h-4" />
              Presença
            </span>
            <span className="font-medium">
              <span className="text-primary">{presentes}</span>
              <span className="text-muted-foreground"> de {total}</span>
            </span>
          </div>
          <Progress value={porcentagem} className="h-2" />
        </div>
      </div>

      {/* Lista de Chamada */}
      <div className="p-4">
        {loadingMembros ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : Object.keys(membrosAgrupados).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">Nenhum membro encontrado</h3>
              <p className="text-muted-foreground text-sm mt-2">
                Você não tem membros para fazer chamada neste culto.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Accordion type="multiple" defaultValue={Object.keys(membrosAgrupados)} className="space-y-3">
            {Object.entries(membrosAgrupados).map(([grupo, membrosList]) => {
              const presentesGrupo = membrosList.filter((m) => getEstadoEfetivo(m)).length;
              
              return (
                <AccordionItem key={grupo} value={grupo} className="border rounded-lg overflow-hidden">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                    <div className="flex items-center justify-between w-full pr-2">
                      <span className="font-semibold">{grupo}</span>
                      <Badge variant="outline" className="ml-2">
                        {presentesGrupo}/{membrosList.length}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
                    <div className="divide-y">
                      {membrosList.map((membro) => {
                        const marcado = getEstadoEfetivo(membro);
                        const isLoading = optimisticStates[membro.pessoa_id] !== undefined;
                        
                        return (
                          <div
                            key={membro.pessoa_id}
                            className={`flex items-center justify-between p-4 transition-colors ${
                              marcado ? "bg-primary/5" : ""
                            }`}
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Avatar className="w-10 h-10">
                                <AvatarImage src={membro.avatar_url || undefined} />
                                <AvatarFallback className="text-sm font-medium">
                                  {membro.nome?.substring(0, 2).toUpperCase() || "??"}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">{membro.nome}</p>
                                {marcado && (
                                  <p className="text-xs text-primary flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Presente
                                  </p>
                                )}
                              </div>
                            </div>
                            <Switch
                              checked={marcado}
                              onCheckedChange={() => handleToggle(membro.pessoa_id, marcado)}
                              disabled={isLoading}
                              className="data-[state=checked]:bg-primary"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
