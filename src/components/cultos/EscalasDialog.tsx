import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Users, UserPlus, Check, X, CheckCircle2, XCircle, Clock, AlertTriangle, Bell, CheckCheck, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";

interface Culto {
  id: string;
  titulo: string;
  data_culto: string;
  tipo: string;
}

interface Time {
  id: string;
  nome: string;
  categoria: string;
  cor: string | null;
}

interface MembroTime {
  id: string;
  pessoa_id: string;
  posicao_id: string | null;
  profiles: {
    nome: string;
    email: string | null;
  };
  posicoes_time: {
    nome: string;
  } | null;
}

interface Escala {
  id: string;
  culto_id: string;
  time_id: string;
  pessoa_id: string;
  posicao_id: string | null;
  confirmado: boolean;
  status_confirmacao?: string | null;
  checkin_realizado?: boolean;
  observacoes: string | null;
  profiles: {
    nome: string;
  };
  posicoes_time: {
    nome: string;
  } | null;
}

interface EscalasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  culto: Culto | null;
}

export default function EscalasDialog({ open, onOpenChange, culto }: EscalasDialogProps) {
  const { profile } = useAuth();
  const [times, setTimes] = useState<Time[]>([]);
  const [timeSelecionado, setTimeSelecionado] = useState<string>("");
  const [membrosTime, setMembrosTime] = useState<MembroTime[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddMembro, setShowAddMembro] = useState(false);
  const [sendingNotifications, setSendingNotifications] = useState(false);

  useEffect(() => {
    if (open && culto) {
      loadTimes();
      loadEscalas();
    }
  }, [open, culto]);

  useEffect(() => {
    if (timeSelecionado) {
      loadMembrosTime();
    }
  }, [timeSelecionado]);

  const loadTimes = async () => {
    try {
      const { data, error } = await supabase
        .from("times_culto")
        .select("*")
        .eq("ativo", true)
        .order("categoria", { ascending: true })
        .order("nome", { ascending: true });

      if (error) throw error;
      setTimes(data || []);
      if (data && data.length > 0 && !timeSelecionado) {
        setTimeSelecionado(data[0].id);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar times", {
        description: error.message,
      });
    }
  };

  const loadMembrosTime = async () => {
    if (!timeSelecionado) return;

    try {
      const { data, error } = await supabase
        .from("membros_time")
        .select(
          `
          *,
          profiles:pessoa_id(nome, email),
          posicoes_time:posicao_id(nome)
        `,
        )
        .eq("time_id", timeSelecionado)
        .eq("ativo", true)
        .order("profiles(nome)", { ascending: true });

      if (error) throw error;
      setMembrosTime(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar membros do time", {
        description: error.message,
      });
    }
  };

  const loadEscalas = async () => {
    if (!culto) return;

    try {
      const { data, error } = await supabase
        .from("escalas_culto")
        .select(
          `
          *,
          profiles:pessoa_id(nome),
          posicoes_time:posicao_id(nome)
        `,
        )
        .eq("culto_id", culto.id);

      if (error) throw error;
      setEscalas(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar escalas", {
        description: error.message,
      });
    }
  };

  const handleAdicionarEscala = async (membro: MembroTime) => {
    if (!culto || !timeSelecionado) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("escalas_culto").insert({
        culto_id: culto.id,
        time_id: timeSelecionado,
        pessoa_id: membro.pessoa_id,
        posicao_id: membro.posicao_id,
        confirmado: false,
      });

      if (error) throw error;

      toast.success("Membro escalado com sucesso!");
      loadEscalas();
    } catch (error: any) {
      if (error.code === "23505") {
        toast.error("Este membro já está escalado nesta posição");
      } else {
        toast.error("Erro ao escalar membro", {
          description: error.message,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoverEscala = async (escalaId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.from("escalas_culto").delete().eq("id", escalaId);

      if (error) throw error;

      toast.success("Membro removido da escala!");
      loadEscalas();
    } catch (error: any) {
      toast.error("Erro ao remover da escala", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmarPresenca = async (escala: Escala) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("escalas_culto")
        .update({ confirmado: !escala.confirmado })
        .eq("id", escala.id);

      if (error) throw error;

      toast.success(escala.confirmado ? "Presença desmarcada" : "Presença confirmada!");
      loadEscalas();
    } catch (error: any) {
      toast.error("Erro ao atualizar confirmação", {
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNotificarPendentes = async () => {
    const pendentes = escalasDoTime.filter(
      e => !e.status_confirmacao || e.status_confirmacao === "pendente"
    );

    if (pendentes.length === 0) {
      toast.info("Não há escalas pendentes para notificar");
      return;
    }

    setSendingNotifications(true);
    let sucessos = 0;
    let erros = 0;

    try {
      for (const escala of pendentes) {
        try {
          const { error } = await supabase.functions.invoke('disparar-alerta', {
            body: {
              user_id: escala.pessoa_id,
              titulo: 'Confirme sua Escala',
              mensagem: `Olá! Você foi escalado para ${culto?.titulo} no time ${timeAtual?.nome}. Por favor, confirme sua presença no App.`,
              tipo: 'push'
            }
          });

          if (error) throw error;
          sucessos++;
        } catch (error) {
          console.error(`Erro ao notificar ${escala.profiles.nome}:`, error);
          erros++;
        }
      }

      if (sucessos > 0) {
        toast.success(`✅ ${sucessos} notificação(ões) enviada(s)!`, {
          description: erros > 0 ? `${erros} falharam` : undefined
        });
      }
      if (erros === pendentes.length) {
        toast.error("Falha ao enviar notificações");
      }
    } catch (error) {
      console.error("Erro geral ao notificar:", error);
      toast.error("Erro ao enviar notificações");
    } finally {
      setSendingNotifications(false);
    }
  };

  const getStatusIcon = (escala: Escala) => {
    const status = escala.status_confirmacao || (escala.confirmado ? "aceito" : "pendente");
    
    // Se já fez checkin, mostrar check duplo
    if (escala.checkin_realizado) {
      return <CheckCheck className="w-4 h-4 text-green-600" />;
    }
    
    switch (status) {
      case "aceito":
      case "confirmado":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case "recusado":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "troca_solicitada":
        return <RefreshCw className="w-4 h-4 text-orange-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (escala: Escala) => {
    // Priorizar checkin se realizado
    if (escala.checkin_realizado) {
      return (
        <Badge className="gap-1 bg-green-600/20 text-green-800 border-green-600/30">
          <CheckCheck className="w-3 h-3" />
          Check-in OK
        </Badge>
      );
    }

    const status = escala.status_confirmacao || (escala.confirmado ? "aceito" : "pendente");
    
    switch (status) {
      case "aceito":
      case "confirmado":
        return (
          <Badge className="gap-1 bg-green-500/20 text-green-700 border-green-500/30">
            <CheckCircle2 className="w-3 h-3" />
            Confirmado
          </Badge>
        );
      case "recusado":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            Recusado
          </Badge>
        );
      case "troca_solicitada":
        return (
          <Badge variant="outline" className="gap-1 bg-orange-500/20 text-orange-700 border-orange-500/30">
            <RefreshCw className="w-3 h-3" />
            Troca Solicitada
          </Badge>
        );
      default: // pendente
        return (
          <Badge variant="secondary" className="gap-1 bg-yellow-500/20 text-yellow-700 border-yellow-500/30">
            <Clock className="w-3 h-3" />
            Pendente
          </Badge>
        );
    }
  };

  const escalasDoTime = escalas.filter((e) => e.time_id === timeSelecionado);
  const membrosDisponiveis = membrosTime.filter(
    (m) => !escalasDoTime.some((e) => e.pessoa_id === m.pessoa_id && e.posicao_id === m.posicao_id),
  );

  const timeAtual = times.find((t) => t.id === timeSelecionado);
  //const isAdmin = profile?.user_id; // Simplificado - em produção, verificar se é admin
  const { hasAccess } = useAuth();
  const isAdmin = hasAccess("cultos", "aprovar_gerenciar");

  if (!culto) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Escalas - {culto.titulo}</DialogTitle>
          <DialogDescription>
            {format(new Date(culto.data_culto), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Seletor de Time */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecionar Time</label>
            <Select value={timeSelecionado} onValueChange={setTimeSelecionado}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um time" />
              </SelectTrigger>
              <SelectContent className="bg-background z-50">
                {times.map((time) => (
                  <SelectItem key={time.id} value={time.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: time.cor || "#8B5CF6" }} />
                      {time.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid md:grid-cols-2 gap-4 flex-1 overflow-hidden">
            {/* Escalados */}
            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <span>Escalados ({escalasDoTime.length})</span>
                    {timeAtual && (
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: timeAtual.cor || "#8B5CF6" }}
                      >
                        <Users className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </CardTitle>
                  {isAdmin && escalasDoTime.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleNotificarPendentes}
                      disabled={sendingNotifications || loading}
                      className="gap-2"
                    >
                      <Bell className="w-4 h-4" />
                      {sendingNotifications ? "Enviando..." : "Notificar Pendentes"}
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-0 flex-1 overflow-hidden">
                <ScrollArea className="h-full">
                  <div className="space-y-2">
                    {escalasDoTime.map((escala) => {
                      const isRecusado = escala.status_confirmacao === "recusado";
                      const isTrocaSolicitada = escala.status_confirmacao === "troca_solicitada";
                      const needsAttention = isRecusado || isTrocaSolicitada;
                      
                      return (
                        <Card 
                          key={escala.id} 
                          className={`relative ${
                            needsAttention ? "border-orange-500/50 bg-orange-500/5" : ""
                          }`}
                        >
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {getStatusIcon(escala)}
                                  <p className="font-medium text-sm">{escala.profiles.nome}</p>
                                </div>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  {escala.posicoes_time && (
                                    <Badge variant="outline" className="text-xs">
                                      {escala.posicoes_time.nome}
                                    </Badge>
                                  )}
                                  {getStatusBadge(escala)}
                                </div>
                                {escala.observacoes && (
                                  <p className="text-xs text-muted-foreground mt-1 italic">
                                    {escala.observacoes}
                                  </p>
                                )}
                                {needsAttention && (
                                  <div className="mt-2 p-2 rounded bg-orange-500/10 border border-orange-500/20">
                                    <p className="text-xs font-medium text-orange-700">
                                      {isRecusado && "⚠️ Encontre um substituto"}
                                      {isTrocaSolicitada && "🔄 Resolva a solicitação de troca"}
                                    </p>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-1">
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleConfirmarPresenca(escala)}
                                    disabled={loading}
                                    title={escala.confirmado ? "Desmarcar confirmação" : "Confirmar presença"}
                                  >
                                    {escala.confirmado ? (
                                      <XCircle className="w-4 h-4 text-destructive" />
                                    ) : (
                                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                                    )}
                                  </Button>
                                )}
                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleRemoverEscala(escala.id)}
                                    disabled={loading}
                                    title={needsAttention ? "Remover e buscar substituto" : "Remover da escala"}
                                  >
                                    <X className="w-4 h-4 text-destructive" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    {escalasDoTime.length === 0 && (
                      <div className="text-center p-8">
                        <Users className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Nenhum membro escalado neste time</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Membros Disponíveis */}
            {isAdmin && (
              <Card className="flex flex-col overflow-hidden">
                <CardHeader className="p-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <UserPlus className="w-4 h-4" />
                    Membros Disponíveis ({membrosDisponiveis.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 flex-1 overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="space-y-2">
                      {membrosDisponiveis.map((membro) => (
                        <Card key={membro.id} className="hover:bg-muted/50 transition-colors">
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-sm">{membro.profiles.nome}</p>
                                {membro.posicoes_time && (
                                  <Badge variant="outline" className="text-xs mt-1">
                                    {membro.posicoes_time.nome}
                                  </Badge>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleAdicionarEscala(membro)}
                                disabled={loading}
                                className="bg-gradient-primary"
                              >
                                <UserPlus className="w-4 h-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      {membrosDisponiveis.length === 0 && (
                        <div className="text-center p-8">
                          <Check className="w-12 h-12 mx-auto text-green-500 mb-2" />
                          <p className="text-sm text-muted-foreground">Todos os membros já estão escalados</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Resumo de Confirmações */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="text-sm">
                      {escalas.filter((e) => e.confirmado || e.status_confirmacao === "aceite").length} confirmados
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    <span className="text-sm">
                      {escalas.filter((e) => !e.confirmado && (!e.status_confirmacao || e.status_confirmacao === "pendente")).length} pendentes
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    <span className="text-sm">
                      {escalas.filter((e) => e.status_confirmacao === "recusado").length} recusados
                    </span>
                  </div>
                </div>
                <Badge variant="outline">Total: {escalas.length} escalados</Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
