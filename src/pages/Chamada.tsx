import React, { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeft, Calendar, CheckCircle2, Users, AlertCircle, Check, Loader } from "lucide-react";
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

interface Evento {
  id: string;
  titulo: string;
  data_evento: string;
}

export default function Chamada() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Estado local para presenças (true = presente, false = ausente)
  // Por padrão, todos começam como "presente"
  const [presencas, setPresencas] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Buscar culto mais próximo (hoje ou mais recente)
  const { data: culto, isLoading: loadingCulto } = useQuery({
    queryKey: ["culto-hoje"],
    queryFn: async () => {
      const hoje = new Date().toISOString().split("T")[0];
      
      // Primeiro tenta buscar culto de hoje
      const { data: cultoHoje, error: errorHoje } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento")
        .gte("data_evento", `${hoje}T00:00:00`)
        .lte("data_evento", `${hoje}T23:59:59`)
        .order("data_evento", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (errorHoje) throw errorHoje;
      if (cultoHoje) return cultoHoje as Evento;

      // Se não houver culto hoje, busca o mais recente
      const { data: cultoRecente, error: errorRecente } = await supabase
        .from("eventos")
        .select("id, titulo, data_evento")
        .lt("data_evento", `${hoje}T00:00:00`)
        .order("data_evento", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (errorRecente) throw errorRecente;
      return cultoRecente as Evento | null;
    },
  });

  // Buscar lista de membros/inscritos (híbrido baseado em requer_inscricao)
  const { data: membros, isLoading: loadingMembros } = useQuery({
    queryKey: ["lista-chamada", culto?.id],
    queryFn: async () => {
      if (!culto?.id) return [];
      
      try {
        // Buscar dados do evento para saber se requer inscrição
        const { data: evento, error: eventoError } = await supabase
          .from("eventos")
          .select("requer_inscricao, tipo")
          .eq("id", culto.id)
          .single();

        if (eventoError) {
          console.error("Erro ao buscar evento:", eventoError);
          throw eventoError;
        }

        console.log("Evento carregado:", evento);

        let pessoas: Array<{ id: string; nome: string; avatar_url: string | null }> = [];

        // Se requer inscrição, buscar inscritos
        if (evento?.requer_inscricao) {
          console.log("Buscando inscritos (requer_inscricao=true)");
          const { data: inscritos, error: inscritos_error } = await supabase
            .from("inscricoes_eventos")
            .select("pessoa_id")
            .eq("evento_id", culto.id)
            .is("cancelado_em", null);

          if (inscritos_error) {
            console.error("Erro ao buscar inscritos:", inscritos_error);
            throw inscritos_error;
          }

          // Buscar dados dos profiles dos inscritos
          const pessoaIds = (inscritos || []).map(i => i.pessoa_id);
          console.log("Pessoa IDs inscritos:", pessoaIds);
          
          if (pessoaIds.length > 0) {
            const { data: profiles, error: profilesError } = await supabase
              .from("profiles")
              .select("id, nome, avatar_url")
              .in("id", pessoaIds)
              .order("nome");

            if (profilesError) {
              console.error("Erro ao buscar profiles dos inscritos:", profilesError);
              throw profilesError;
            }
            pessoas = profiles || [];
            console.log("Profiles dos inscritos carregados:", pessoas.length);
          }
        } else {
          // Se não requer inscrição (culto), buscar membros
          console.log("Buscando membros (requer_inscricao=false)");
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, nome, avatar_url")
            .eq("status", "membro")
            .order("nome");

          if (profilesError) {
            console.error("Erro ao buscar membros:", profilesError);
            throw profilesError;
          }
          pessoas = profiles || [];
          console.log("Membros carregados:", pessoas.length);
        }

        // Buscar as presenças JÁ REGISTRADAS deste evento
        const { data: checkins, error: checkinsError } = await supabase
          .from("checkins")
          .select("pessoa_id")
          .eq("evento_id", culto.id);

        if (checkinsError) {
          console.error("Erro ao buscar checkins:", checkinsError);
          throw checkinsError;
        }

        const checkinIds = new Set(checkins?.map(c => c.pessoa_id) || []);
        console.log("Checkins carregados:", checkinIds.size);

        // Montar lista de membros/inscritos
        return pessoas.map(p => ({
          pessoa_id: p.id,
          nome: p.nome,
          avatar_url: p.avatar_url,
          nome_grupo: "Participante",
          tipo_grupo: "geral",
          ja_marcado: checkinIds.has(p.id),
        } as MembroChamada));
      } catch (error) {
        console.error("Erro ao buscar lista de chamada:", error);
        return [];
      }
    },
    enabled: !!culto?.id,
  });

  // Inicializar presenças quando membros carregarem
  // Usa os checkins já gravados como fonte de verdade
  React.useEffect(() => {
    if (membros && membros.length > 0) {
      const presencasIniciais: Record<string, boolean> = {};
      membros.forEach(m => {
        // VERDADE DO BANCO: ja_marcado indica se foi gravado um checkin
        presencasIniciais[m.pessoa_id] = m.ja_marcado; // true se tem checkin, false se não tem
      });
      setPresencas(presencasIniciais);
    }
  }, [membros]);

  // Buscar user_id atual
  const { data: currentUser } = useQuery({
    queryKey: ["current-user"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      return user;
    },
  });

  // Função para salvar TODAS as presenças de uma vez
  const handleSalvarPresencas = async () => {
    if (!culto?.id || !currentUser?.id || !membros) return;

    setIsSaving(true);
    try {
      // Separar quem vai ficar marcado vs desmarcado
      const paraMarcados: string[] = [];
      const paraDesmarcados: string[] = [];

      membros.forEach(m => {
        const currentState = presencas[m.pessoa_id];
        const previousState = m.ja_marcado;

        // Se mudou de desmarcado para marcado
        if (currentState === true && previousState === false) {
          paraMarcados.push(m.pessoa_id);
        }
        // Se mudou de marcado para desmarcado
        else if (currentState === false && previousState === true) {
          paraDesmarcados.push(m.pessoa_id);
        }
      });

      // Deletar os desmarcados
      if (paraDesmarcados.length > 0) {
        const { error: deleteError } = await supabase
          .from("checkins")
          .delete()
          .eq("evento_id", culto.id)
          .in("pessoa_id", paraDesmarcados);

        if (deleteError) throw deleteError;
      }

      // Inserir os marcados
      if (paraMarcados.length > 0) {
        const { error: insertError } = await supabase
          .from("checkins")
          .insert(
            paraMarcados.map(pessoaId => ({
              evento_id: culto.id,
              pessoa_id: pessoaId,
              metodo: "lider_celula",
              validado_por: currentUser.id,
            }))
          );

        if (insertError) throw insertError;
      }

      const totalAlteracoes = paraMarcados.length + paraDesmarcados.length;
      toast.success(`✅ ${totalAlteracoes} mudança(s) salva(s)!`);
      queryClient.invalidateQueries({ queryKey: ["lista-chamada", culto?.id] });
      queryClient.invalidateQueries({ queryKey: ["chamada-stats", culto?.id] });
    } catch (error) {
      console.error("Erro ao salvar presenças:", error);
      toast.error("Erro ao salvar presenças");
    } finally {
      setIsSaving(false);
    }
  };

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
    const presentes = Object.values(presencas).filter(Boolean).length;
    return { presentes, total, porcentagem: total > 0 ? (presentes / total) * 100 : 0 };
  }, [membros, presencas]);

  // Alternar presença (desmarcar ausente)
  const handleTogglePresenca = (pessoaId: string) => {
    setPresencas(prev => ({
      ...prev,
      [pessoaId]: !prev[pessoaId],
    }));
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

  if (!membros || membros.length === 0) {
    return (
      <div className="min-h-screen p-4">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar
        </Button>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">Nenhum membro encontrado</h3>
            <p className="text-muted-foreground text-sm mt-2">
              Não há membros para fazer chamada neste culto.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dataCulto = new Date(culto.data_evento);
  const isHoje = new Date().toDateString() === dataCulto.toDateString();

  return (
    <div className="min-h-screen pb-32">
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
        ) : (
          <Accordion type="multiple" defaultValue={Object.keys(membrosAgrupados)} className="space-y-3">
            {Object.entries(membrosAgrupados).map(([grupo, membrosList]) => {
              const presentesGrupo = membrosList.filter((m) => presencas[m.pessoa_id] === true).length;
              
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
                        const marcado = presencas[membro.pessoa_id] === true;
                        
                        return (
                          <div
                            key={membro.pessoa_id}
                            className={`flex items-center justify-between p-4 transition-colors ${
                              marcado ? "bg-primary/5" : "bg-destructive/5"
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
                                {!marcado && (
                                  <p className="text-xs text-destructive flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3" />
                                    Ausente
                                  </p>
                                )}
                              </div>
                            </div>
                            <Switch
                              checked={marcado}
                              onCheckedChange={() => handleTogglePresenca(membro.pessoa_id)}
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

      {/* Footer: Botão Salvar Fixo */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex gap-3">
        <Button
          variant="outline"
          size="lg"
          onClick={() => {
            // Resetar para o estado original do banco
            const presencasReset: Record<string, boolean> = {};
            membros?.forEach(m => {
              presencasReset[m.pessoa_id] = m.ja_marcado; // Volta ao estado original
            });
            setPresencas(presencasReset);
          }}
          disabled={isSaving}
          className="flex-1"
        >
          Descartar Alterações
        </Button>
        <Button
          size="lg"
          onClick={handleSalvarPresencas}
          disabled={isSaving}
          className="flex-1"
        >
          {isSaving ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Check className="w-4 h-4 mr-2" />
              Salvar Presença
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
