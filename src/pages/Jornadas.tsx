import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Users, ArrowLeft, ChevronRight, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import NovaJornadaDialog from "@/components/jornadas/NovaJornadaDialog";

export default function Jornadas() {
  const navigate = useNavigate();
  const [showNovaJornada, setShowNovaJornada] = useState(false);

  const { data: jornadas, isLoading, refetch } = useQuery({
    queryKey: ["jornadas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("jornadas")
        .select(`
          *,
          etapas_jornada(id),
          inscricoes_jornada(
            id, 
            concluido,
            pessoa:profiles!inscricoes_jornada_pessoa_id_fkey(id, nome, avatar_url)
          )
        `)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const getInitials = (nome: string) => {
    return nome
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  };

  const getTipoLabel = (tipo?: string) => {
    switch (tipo) {
      case 'auto_instrucional':
        return {
          label: 'Curso',
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          icon: <BookOpen className="w-3.5 h-3.5" />
        };
      case 'processo_acompanhado':
        return {
          label: 'Processo',
          color: 'bg-green-100 text-green-800 border-green-200',
          icon: <Users className="w-3.5 h-3.5" />
        };
      case 'hibrido':
        return {
          label: 'Híbrido',
          color: 'bg-purple-100 text-purple-800 border-purple-200',
          icon: null
        };
      default:
        return {
          label: 'Jornada',
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          icon: null
        };
    }
  };

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/pessoas")}
              className="rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Jornadas</h1>
              <p className="text-sm text-muted-foreground">
                Trilhas de discipulado e formação
              </p>
            </div>
          </div>
          <Button onClick={() => setShowNovaJornada(true)} size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Nova Jornada
          </Button>
        </div>

        {/* Grid de Jornadas */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-xl" />
            ))}
          </div>
        ) : jornadas && jornadas.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {jornadas.map((jornada) => {
              const inscricoes = jornada.inscricoes_jornada || [];
              const totalInscritos = inscricoes.length;
              const concluidos = inscricoes.filter((i: any) => i.concluido).length;
              const etapas = jornada.etapas_jornada?.length || 0;
              const progressoGeral = totalInscritos > 0 
                ? Math.round((concluidos / totalInscritos) * 100) 
                : 0;
              const pessoas = inscricoes
                .map((i: any) => i.pessoa)
                .filter(Boolean)
                .slice(0, 3);
              const maisCount = Math.max(0, totalInscritos - 3);

              return (
                <Card
                  key={jornada.id}
                  className="group cursor-pointer hover:shadow-md transition-all duration-200 bg-card border h-full flex flex-col"
                  onClick={() => navigate(`/jornadas/${jornada.id}`)}
                >
                  <CardContent className="p-5 flex flex-col flex-1">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: jornada.cor_tema || "#3b82f6" }}
                          />
                          <h3 className="font-semibold text-base truncate leading-tight">
                            {jornada.titulo}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs font-normal shrink-0">
                            {etapas} etapas
                          </Badge>
                          {(() => {
                            const tipo = getTipoLabel(jornada.tipo_jornada);
                            return (
                              <Badge className={`text-xs font-normal shrink-0 border ${tipo.color} flex items-center gap-1`}>
                                {tipo.icon && tipo.icon}
                                {tipo.label}
                              </Badge>
                            );
                          })()}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </div>

                    {/* Descrição */}
                    {jornada.descricao && (
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {jornada.descricao}
                      </p>
                    )}

                    {/* Footer */}
                    <div className="space-y-3 mt-auto">
                      {/* Avatar Group */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center shrink-0">
                          {pessoas.length > 0 ? (
                            <div className="flex -space-x-2">
                              {pessoas.map((pessoa: any, idx: number) => (
                                <Avatar
                                  key={pessoa.id}
                                  className="w-7 h-7 border-2 border-background"
                                  style={{ zIndex: pessoas.length - idx }}
                                >
                                  <AvatarImage src={pessoa.avatar_url} />
                                  <AvatarFallback className="text-[10px] bg-muted">
                                    {getInitials(pessoa.nome)}
                                  </AvatarFallback>
                                </Avatar>
                              ))}
                              {maisCount > 0 && (
                                <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center">
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    +{maisCount}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Nenhum inscrito
                            </span>
                          )}
                        </div>
                        {concluidos > 0 && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {concluidos} concluídos
                          </span>
                        )}
                      </div>

                      {/* Barra de Progresso */}
                      {totalInscritos > 0 && (
                        <div className="space-y-1">
                          <Progress value={progressoGeral} className="h-1" />
                          <p className="text-[11px] text-muted-foreground text-right">
                            {progressoGeral}% concluído
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="flex flex-col items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                  <Users className="w-7 h-7 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-1">Nenhuma jornada criada</h3>
                  <p className="text-muted-foreground text-sm">
                    Crie sua primeira trilha de discipulado
                  </p>
                </div>
                <Button onClick={() => setShowNovaJornada(true)} size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Criar Jornada
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <NovaJornadaDialog
        open={showNovaJornada}
        onOpenChange={setShowNovaJornada}
        onSuccess={() => {
          refetch();
          setShowNovaJornada(false);
        }}
      />
    </div>
  );
}
