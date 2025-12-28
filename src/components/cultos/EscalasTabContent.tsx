import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Users, 
  UserPlus, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  X,
  Clock
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface Time {
  id: string;
  nome: string;
  categoria: string;
  cor: string | null;
}

interface Posicao {
  id: string;
  nome: string;
  time_id: string;
}

interface MembroTime {
  id: string;
  pessoa_id: string;
  posicao_id: string | null;
  profiles: { nome: string };
  posicoes_time: { nome: string } | null;
}

interface Escala {
  id: string;
  time_id: string;
  pessoa_id: string;
  posicao_id: string | null;
  confirmado: boolean;
  status_confirmacao?: string | null;
  profiles: { nome: string };
  posicoes_time: { nome: string } | null;
}

interface EscalasTabContentProps {
  eventoId: string;
}

export default function EscalasTabContent({ eventoId }: EscalasTabContentProps) {
  const { hasAccess } = useAuth();
  const isAdmin = hasAccess("eventos", "aprovar_gerenciar");
  
  const [times, setTimes] = useState<Time[]>([]);
  const [posicoes, setPosicoes] = useState<Posicao[]>([]);
  const [membrosTime, setMembrosTime] = useState<Record<string, MembroTime[]>>({});
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [eventoId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [timesRes, posicoesRes, escalasRes] = await Promise.all([
        supabase.from("times").select("*").eq("ativo", true).order("categoria").order("nome"),
        supabase.from("posicoes_time").select("*").eq("ativo", true),
        supabase.from("escalas")
          .select(`*, profiles:pessoa_id(nome), posicoes_time:posicao_id(nome)`)
          .eq("evento_id", eventoId)
      ]);

      if (timesRes.error) throw timesRes.error;
      if (posicoesRes.error) throw posicoesRes.error;
      if (escalasRes.error) throw escalasRes.error;

      setTimes(timesRes.data || []);
      setPosicoes(posicoesRes.data || []);
      setEscalas(escalasRes.data || []);

      // Load members for each team
      const membrosMap: Record<string, MembroTime[]> = {};
      for (const time of timesRes.data || []) {
        const { data } = await supabase
          .from("membros_time")
          .select(`*, profiles:pessoa_id(nome), posicoes_time:posicao_id(nome)`)
          .eq("time_id", time.id)
          .eq("ativo", true);
        membrosMap[time.id] = data || [];
      }
      setMembrosTime(membrosMap);
    } catch (error: unknown) {
      toast.error("Erro ao carregar dados", { description: error instanceof Error ? error.message : String(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleAddEscala = async (timeId: string, pessoaId: string, posicaoId: string | null) => {
    try {
      const { error } = await supabase.from("escalas").insert({
        evento_id: eventoId,
        time_id: timeId,
        pessoa_id: pessoaId,
        posicao_id: posicaoId,
        confirmado: false,
      });
      if (error) throw error;
      toast.success("Voluntário escalado!");
      loadData();
    } catch (error: unknown) {
      const pgError = error as { code?: string };
      if (pgError.code === "23505") {
        toast.error("Este voluntário já está escalado");
      } else {
        toast.error("Erro ao escalar", { description: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  const handleRemoveEscala = async (escalaId: string) => {
    try {
      const { error } = await supabase.from("escalas").delete().eq("id", escalaId);
      if (error) throw error;
      toast.success("Voluntário removido da escala");
      loadData();
    } catch (error: unknown) {
      toast.error("Erro ao remover", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const handleToggleConfirmacao = async (escala: Escala) => {
    try {
      const { error } = await supabase
        .from("escalas")
        .update({ confirmado: !escala.confirmado })
        .eq("id", escala.id);
      if (error) throw error;
      loadData();
    } catch (error: unknown) {
      toast.error("Erro ao atualizar", { description: error instanceof Error ? error.message : String(error) });
    }
  };

  const getStatusIcon = (escala: Escala) => {
    const status = escala.status_confirmacao || (escala.confirmado ? "aceito" : "pendente");
    
    switch (status) {
      case "aceito":
      case "confirmado":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "recusado":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "troca_solicitada":
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default:
        return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  // Group teams by category
  const timesByCategoria = times.reduce((acc, time) => {
    if (!acc[time.categoria]) acc[time.categoria] = [];
    acc[time.categoria].push(time);
    return acc;
  }, {} as Record<string, Time[]>);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-pulse">Carregando escalas...</div>
        </CardContent>
      </Card>
    );
  }

  const totalEscalados = escalas.length;
  const totalConfirmados = escalas.filter(e => e.confirmado).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="h-5 w-5" />
          Escalas do Culto
        </h3>
        <div className="flex items-center gap-4 text-sm flex-wrap">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>{totalConfirmados} confirmados</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4 text-yellow-500" />
            <span>{totalEscalados - totalConfirmados} pendentes</span>
          </div>
          <Badge variant="outline">Total: {totalEscalados}</Badge>
        </div>
      </div>

      {/* Teams by Category */}
      {Object.entries(timesByCategoria).map(([categoria, timesCategoria]) => (
        <div key={categoria} className="space-y-4">
          <h4 className="font-semibold text-muted-foreground uppercase text-sm tracking-wide">{categoria}</h4>
          <div className="grid gap-4 md:grid-cols-2">
            {timesCategoria.map((time) => {
              const escalasTime = escalas.filter(e => e.time_id === time.id);
              const posicoesTime = posicoes.filter(p => p.time_id === time.id);
              const membros = membrosTime[time.id] || [];
              const pessoasEscaladas = escalasTime.map(e => e.pessoa_id);

              return (
                <Card key={time.id}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: time.cor || "hsl(var(--primary))" }} 
                        />
                        {time.nome}
                      </div>
                      <Badge variant="secondary">{escalasTime.length}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Posições necessárias */}
                    {posicoesTime.length > 0 && (
                      <div className="space-y-2">
                        {posicoesTime.map((posicao) => {
                          const escalasPosicao = escalasTime.filter(e => e.posicao_id === posicao.id);
                          const isEmpty = escalasPosicao.length === 0;

                          return (
                            <div 
                              key={posicao.id} 
                              className={`p-2 rounded-md border ${isEmpty ? "border-yellow-500/50 bg-yellow-500/5" : "border-border"}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  {isEmpty && <AlertTriangle className="h-4 w-4 text-yellow-500" />}
                                  <span className="text-sm font-medium">{posicao.nome}</span>
                                </div>
                                {isAdmin && (
                                  <Select onValueChange={(value) => handleAddEscala(time.id, value, posicao.id)}>
                                    <SelectTrigger className="w-[140px] h-7 text-xs">
                                      <SelectValue placeholder="Adicionar" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {membros
                                        .filter(m => !pessoasEscaladas.includes(m.pessoa_id))
                                        .map((m) => (
                                          <SelectItem key={m.pessoa_id} value={m.pessoa_id}>
                                            {m.profiles.nome}
                                          </SelectItem>
                                        ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                              {escalasPosicao.map((escala) => (
                                <div key={escala.id} className="flex items-center justify-between mt-1 pl-6">
                                  <div className="flex items-center gap-2">
                                    {getStatusIcon(escala)}
                                    <span className="text-sm">{escala.profiles.nome}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button 
                                      variant="ghost" 
                                      size="icon" 
                                      className="h-6 w-6"
                                      onClick={() => handleToggleConfirmacao(escala)}
                                      title={escala.confirmado ? "Desmarcar" : "Confirmar"}
                                    >
                                      {escala.confirmado ? (
                                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                                      ) : (
                                        <XCircle className="h-4 w-4 text-muted-foreground" />
                                      )}
                                    </Button>
                                    {isAdmin && (
                                      <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        className="h-6 w-6"
                                        onClick={() => handleRemoveEscala(escala.id)}
                                      >
                                        <X className="h-4 w-4 text-destructive" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Escalados sem posição específica */}
                    {escalasTime.filter(e => !e.posicao_id).length > 0 && (
                      <div className="space-y-1">
                        <span className="text-xs text-muted-foreground">Geral</span>
                        {escalasTime.filter(e => !e.posicao_id).map((escala) => (
                          <div key={escala.id} className="flex items-center justify-between p-1">
                            <div className="flex items-center gap-2">
                              {getStatusIcon(escala)}
                              <span className="text-sm">{escala.profiles.nome}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-6 w-6"
                                onClick={() => handleToggleConfirmacao(escala)}
                              >
                                {escala.confirmado ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-muted-foreground" />
                                )}
                              </Button>
                              {isAdmin && (
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-6 w-6"
                                  onClick={() => handleRemoveEscala(escala.id)}
                                >
                                  <X className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Add button for teams without positions */}
                    {isAdmin && posicoesTime.length === 0 && (
                      <Select onValueChange={(value) => handleAddEscala(time.id, value, null)}>
                        <SelectTrigger className="h-8 text-xs">
                          <UserPlus className="h-3 w-3 mr-2" />
                          <SelectValue placeholder="Adicionar voluntário" />
                        </SelectTrigger>
                        <SelectContent>
                          {membros
                            .filter(m => !pessoasEscaladas.includes(m.pessoa_id))
                            .map((m) => (
                              <SelectItem key={m.pessoa_id} value={m.pessoa_id}>
                                {m.profiles.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    )}

                    {escalasTime.length === 0 && posicoesTime.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-2">
                        Nenhum voluntário escalado
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {times.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum time cadastrado.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
