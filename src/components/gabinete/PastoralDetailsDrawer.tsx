import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  User,
  Calendar,
  Clock,
  Plus,
  AlertCircle,
  Lock,
  MapPin,
  Send,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

type GravidadeEnum = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
type StatusEnum = "PENDENTE" | "TRIAGEM" | "AGENDADO" | "EM_ACOMPANHAMENTO" | "CONCLUIDO";

interface AtendimentoPastoral {
  id: string;
  created_at: string;
  pessoa_id: string | null;
  visitante_id: string | null;
  origem: string | null;
  motivo_resumo: string | null;
  conteudo_original: string | null;
  gravidade: GravidadeEnum | null;
  status: StatusEnum | null;
  pastor_responsavel_id: string | null;
  data_agendamento: string | null;
  local_atendimento: string | null;
  observacoes_internas: string | null;
  historico_evolucao: Array<{ data: string; autor: string; acao: string; detalhes?: string }> | null;
  pessoa?: { nome: string | null; telefone: string | null } | null;
  visitante?: { nome: string | null; telefone: string | null } | null;
  pastor?: { nome: string | null } | null;
}

interface EvolucaoNota {
  data: string;
  autor: string;
  texto?: string;
  acao?: string;
  detalhes?: string;
}

interface Pastor {
  id: string;
  nome: string;
}

const GRAVIDADE_COLORS: Record<GravidadeEnum, string> = {
  BAIXA: "bg-emerald-500/20 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
  MEDIA: "bg-amber-500/20 text-amber-700 border-amber-500/30 dark:text-amber-400",
  ALTA: "bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-400",
  CRITICA: "bg-destructive/20 text-destructive border-destructive/30",
};

const GRAVIDADE_LABELS: Record<GravidadeEnum, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
};

const STATUS_COLORS: Record<StatusEnum, string> = {
  PENDENTE: "bg-muted text-muted-foreground",
  TRIAGEM: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  EM_ACOMPANHAMENTO: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  AGENDADO: "bg-sky-500/20 text-sky-700 dark:text-sky-400",
  CONCLUIDO: "bg-emerald-500/20 text-emerald-700 dark:text-emerald-400",
};

const STATUS_LABELS: Record<StatusEnum, string> = {
  PENDENTE: "Pendente",
  TRIAGEM: "Triagem",
  EM_ACOMPANHAMENTO: "Acompanhando",
  AGENDADO: "Agendado",
  CONCLUIDO: "Concluído",
};

interface PastoralDetailsDrawerProps {
  atendimento: AtendimentoPastoral | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PastoralDetailsDrawer({
  atendimento,
  open,
  onOpenChange,
}: PastoralDetailsDrawerProps) {
  const navigate = useNavigate();
  const { profile, hasAccess } = useAuth();
  const queryClient = useQueryClient();
  const [novaNota, setNovaNota] = useState("");
  const [novaDataAgendamento, setNovaDataAgendamento] = useState("");
  const [localAtendimento, setLocalAtendimento] = useState("");
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [pendingNota, setPendingNota] = useState<EvolucaoNota | null>(null);

  const isPastor = hasAccess('pastoral', 'acesso_completo') || hasAccess('admin', 'acesso_completo');
  const isConteudoConfidencial = atendimento?.conteudo_original === "CONFIDENCIAL";

  const { data: pastores = [] } = useQuery({
    queryKey: ["pastores-lista"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nome")
        .eq("e_pastor", true)
        .order("nome");
      if (error) throw error;
      return data as Pastor[];
    },
  });

  useEffect(() => {
    if (open && atendimento) {
      setNovaNota("");
      setNovaDataAgendamento("");
      setLocalAtendimento(atendimento.local_atendimento || "");
    }
  }, [open, atendimento?.id]);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: StatusEnum }) => {
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      toast.success("Status atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  const updatePastorMutation = useMutation({
    mutationFn: async ({ id, pastor_responsavel_id }: { id: string; pastor_responsavel_id: string | null }) => {
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({ pastor_responsavel_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      toast.success("Pastor atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar pastor");
    },
  });

  const agendarMutation = useMutation({
    mutationFn: async ({
      id,
      data_agendamento,
      local_atendimento,
    }: {
      id: string;
      data_agendamento: string;
      local_atendimento?: string;
    }) => {
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({
          data_agendamento,
          local_atendimento: local_atendimento || null,
          status: "AGENDADO" as StatusEnum,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      toast.success("Agendamento confirmado!");
      setNovaDataAgendamento("");
      setLocalAtendimento("");
    },
    onError: () => {
      toast.error("Erro ao salvar agendamento");
    },
  });

  const addNotaMutation = useMutation({
    mutationFn: async ({
      id,
      nota,
      historicoAtual,
      mudarStatus,
    }: {
      id: string;
      nota: EvolucaoNota;
      historicoAtual: Array<{ data: string; autor: string; acao: string; detalhes?: string }>;
      mudarStatus?: boolean;
    }) => {
      const novoHistorico = [...(historicoAtual || []), { data: nota.data, autor: nota.autor, acao: nota.texto || 'Nota adicionada', detalhes: nota.texto }];
      const updateData: { historico_evolucao: Array<{ data: string; autor: string; acao: string; detalhes?: string }>; status?: StatusEnum } = { historico_evolucao: novoHistorico };
      if (mudarStatus) {
        updateData.status = "EM_ACOMPANHAMENTO" as StatusEnum;
      }
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update(updateData as Record<string, unknown>)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      toast.success(variables.mudarStatus ? "Nota adicionada!" : "Nota adicionada!");
      setNovaNota("");
      setPendingNota(null);
    },
    onError: () => {
      toast.error("Erro ao adicionar nota");
    },
  });

  if (!atendimento) return null;

  const nome = atendimento.pessoa?.nome || atendimento.visitante?.nome || "Não identificado";
  const telefone = atendimento.pessoa?.telefone || atendimento.visitante?.telefone;
  const status = atendimento.status || "PENDENTE";
  const isMembro = !!atendimento.pessoa_id;

  const handleAdicionarNota = () => {
    if (!novaNota.trim()) return;
    const nota: EvolucaoNota = {
      data: new Date().toISOString(),
      autor: profile?.nome || "Sistema",
      texto: novaNota.trim(),
    };
    if (atendimento.status === "PENDENTE") {
      setPendingNota(nota);
      setShowStatusChangeDialog(true);
    } else {
      addNotaMutation.mutate({
        id: atendimento.id,
        nota,
        historicoAtual: atendimento.historico_evolucao || [],
        mudarStatus: false,
      });
    }
  };

  const handleConfirmStatusChange = (mudarStatus: boolean) => {
    if (pendingNota) {
      addNotaMutation.mutate({
        id: atendimento.id,
        nota: pendingNota,
        historicoAtual: atendimento.historico_evolucao || [],
        mudarStatus,
      });
    }
    setShowStatusChangeDialog(false);
  };

  const handleAgendar = () => {
    if (!novaDataAgendamento) return;
    agendarMutation.mutate({
      id: atendimento.id,
      data_agendamento: novaDataAgendamento,
      local_atendimento: localAtendimento,
    });
  };

  const getInitials = (nome: string | null) => {
    if (!nome) return "?";
    const parts = nome.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-md p-0 flex flex-col">
          {/* Header Compacto */}
          <SheetHeader className="p-4 pb-3 border-b bg-muted/30">
            <div className="flex items-start gap-3">
              <div className={cn(
                "h-12 w-12 rounded-full flex items-center justify-center text-sm font-medium shrink-0",
                isMembro ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-700"
              )}>
                {getInitials(nome)}
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-base truncate">{nome}</SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge variant="outline" className={cn("text-[10px] px-1.5", STATUS_COLORS[status])}>
                    {STATUS_LABELS[status]}
                  </Badge>
                  {atendimento.gravidade && (
                    <Badge variant="outline" className={cn("text-[10px] px-1.5", GRAVIDADE_COLORS[atendimento.gravidade])}>
                      {GRAVIDADE_LABELS[atendimento.gravidade]}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground mt-1">
                  Aberto em {format(new Date(atendimento.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                </p>
              </div>
            </div>
          </SheetHeader>

          {/* Conteúdo Scrollável */}
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-4">
              {/* Resumo da Queixa */}
              {atendimento.motivo_resumo && (
                <Card className="bg-muted/30 border-muted">
                  <CardContent className="p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Resumo (IA)</p>
                    <p className="text-sm">{atendimento.motivo_resumo}</p>
                  </CardContent>
                </Card>
              )}

              {/* Alerta Confidencial */}
              {isConteudoConfidencial && (
                <Card className="bg-amber-500/10 border-amber-500/30">
                  <CardContent className="p-3 flex items-center gap-2">
                    <Lock className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      Conteúdo restrito ao Pastor Responsável
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Conteúdo Original (só pastor) */}
              {isPastor && atendimento.conteudo_original && !isConteudoConfidencial && (
                <Card className="bg-orange-500/10 border-orange-500/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
                      <p className="text-xs font-medium text-orange-700">Conteúdo Original</p>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{atendimento.conteudo_original}</p>
                  </CardContent>
                </Card>
              )}

              <Separator />

              {/* Agendamento Existente */}
              {atendimento.data_agendamento && (
                <Card className="bg-sky-500/10 border-sky-500/30">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
                      <Calendar className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {format(new Date(atendimento.data_agendamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    {atendimento.local_atendimento && (
                      <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="text-xs">{atendimento.local_atendimento}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Agendar */}
              <div className="space-y-3">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Agendar Atendimento
                </Label>
                <div className="grid gap-2">
                  <Input
                    type="datetime-local"
                    value={novaDataAgendamento}
                    onChange={(e) => setNovaDataAgendamento(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Input
                    placeholder="Local (opcional)"
                    value={localAtendimento}
                    onChange={(e) => setLocalAtendimento(e.target.value)}
                    className="h-9 text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={handleAgendar}
                    disabled={!novaDataAgendamento || agendarMutation.isPending}
                    className="w-full"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    {atendimento.data_agendamento ? "Reagendar" : "Confirmar Agendamento"}
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Atribuir Pastor */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Pastor Responsável
                </Label>
                <Select
                  value={atendimento.pastor_responsavel_id || ""}
                  onValueChange={(v) =>
                    updatePastorMutation.mutate({
                      id: atendimento.id,
                      pastor_responsavel_id: v || null,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Selecionar pastor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pastores.map((pastor) => (
                      <SelectItem key={pastor.id} value={pastor.id}>
                        {pastor.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Status
                </Label>
                <Select
                  value={status}
                  onValueChange={(v) =>
                    updateStatusMutation.mutate({
                      id: atendimento.id,
                      status: v as StatusEnum,
                    })
                  }
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDENTE">Pendente</SelectItem>
                    <SelectItem value="TRIAGEM">Triagem</SelectItem>
                    <SelectItem value="EM_ACOMPANHAMENTO">Em Acompanhamento</SelectItem>
                    <SelectItem value="AGENDADO">Agendado</SelectItem>
                    <SelectItem value="CONCLUIDO">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Histórico Resumido */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium">Últimas Evoluções</Label>
                  <span className="text-[10px] text-muted-foreground">
                    {atendimento.historico_evolucao?.length || 0} notas
                  </span>
                </div>
                
                {(!atendimento.historico_evolucao || atendimento.historico_evolucao.length === 0) ? (
                  <p className="text-xs text-muted-foreground py-2">Nenhuma evolução registrada</p>
                ) : (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {(atendimento.historico_evolucao || [])
                      .slice(-2)
                      .reverse()
                      .map((nota, index) => (
                        <div key={index} className="bg-muted/30 p-2 rounded text-xs">
                          <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
                            <span className="font-medium text-foreground">{nota.autor}</span>
                            <span>•</span>
                            <span>{format(new Date(nota.data), "dd/MM HH:mm", { locale: ptBR })}</span>
                          </div>
                          <p className="line-clamp-2">{nota.acao || nota.detalhes || ''}</p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Adicionar Nota Rápida */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Nota Rápida
                </Label>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Adicionar observação..."
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleAdicionarNota}
                  disabled={!novaNota.trim() || addNotaMutation.isPending}
                  className="w-full"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Salvar Nota
                </Button>
              </div>
            </div>
          </ScrollArea>

          {/* Footer com ação principal */}
          <div className="p-4 border-t bg-muted/30">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onOpenChange(false);
                navigate(`/gabinete/atendimento/${atendimento.id}`);
              }}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir Prontuário Completo
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog para mudar status */}
      <AlertDialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar Acompanhamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Este atendimento está pendente. Deseja alterar para "Em Acompanhamento"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmStatusChange(false)}>
              Manter Pendente
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmStatusChange(true)}>
              Iniciar Acompanhamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
