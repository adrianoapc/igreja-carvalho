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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  FileText,
  User,
  Calendar,
  Clock,
  Plus,
  AlertCircle,
  MessageSquare,
  Lock,
  MapPin,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  historico_evolucao: any[] | null;
  pessoa?: { nome: string | null; telefone: string | null } | null;
  visitante?: { nome: string | null; telefone: string | null } | null;
  pastor?: { nome: string | null } | null;
}

interface EvolucaoNota {
  data: string;
  autor: string;
  texto: string;
}

interface Pastor {
  id: string;
  nome: string;
}

const GRAVIDADE_COLORS: Record<GravidadeEnum, string> = {
  BAIXA: "bg-green-500/20 text-green-700 border-green-500/30 dark:text-green-400",
  MEDIA: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30 dark:text-yellow-400",
  ALTA: "bg-orange-500/20 text-orange-700 border-orange-500/30 dark:text-orange-400",
  CRITICA: "bg-red-500/20 text-red-700 border-red-500/30 dark:text-red-400",
};

const GRAVIDADE_LABELS: Record<GravidadeEnum, string> = {
  BAIXA: "Baixa",
  MEDIA: "Média",
  ALTA: "Alta",
  CRITICA: "Crítica",
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
  const { profile, hasAccess } = useAuth();
  const queryClient = useQueryClient();
  const [novaNota, setNovaNota] = useState("");
  const [novaDataAgendamento, setNovaDataAgendamento] = useState("");
  const [localAtendimento, setLocalAtendimento] = useState("");
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [pendingNota, setPendingNota] = useState<EvolucaoNota | null>(null);

  const isPastor = hasAccess('pastoral', 'acesso_completo') || hasAccess('admin', 'acesso_completo');
  
  // Verifica se o conteúdo é confidencial (mascarado pela view de segurança)
  const isConteudoConfidencial = atendimento?.conteudo_original === "CONFIDENCIAL";

  // Buscar lista de pastores para o seletor
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

  // Reset fields when drawer opens with new atendimento
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
      toast.success("Pastor responsável atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar pastor responsável");
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
      toast.success("Agendamento confirmado! Status alterado para Agendado.");
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
      historicoAtual: any[];
      mudarStatus?: boolean;
    }) => {
      const novoHistorico = [...(historicoAtual || []), nota];
      const updateData: any = { historico_evolucao: novoHistorico };
      
      if (mudarStatus) {
        updateData.status = "EM_ACOMPANHAMENTO";
      }
      
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update(updateData)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      if (variables.mudarStatus) {
        toast.success("Nota adicionada e status alterado para Em Acompanhamento!");
      } else {
        toast.success("Nota adicionada!");
      }
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

  const handleAdicionarNota = () => {
    if (!novaNota.trim()) return;

    const nota: EvolucaoNota = {
      data: new Date().toISOString(),
      autor: profile?.nome || "Sistema",
      texto: novaNota.trim(),
    };

    // Se status é PENDENTE, pergunta se deseja mudar para EM_ACOMPANHAMENTO
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="p-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Prontuário Pastoral
            </SheetTitle>
            
            {/* Header com nome e seletor de pastor */}
            <div className="mt-3 space-y-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{nome}</span>
                {atendimento.gravidade && (
                  <Badge
                    variant="outline"
                    className={cn("ml-auto", GRAVIDADE_COLORS[atendimento.gravidade])}
                  >
                    {GRAVIDADE_LABELS[atendimento.gravidade]}
                  </Badge>
                )}
              </div>
              
              {/* Seletor de Pastor Responsável */}
              <div className="flex items-center gap-2">
                <UserCog className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={atendimento.pastor_responsavel_id || ""}
                  onValueChange={(v) =>
                    updatePastorMutation.mutate({
                      id: atendimento.id,
                      pastor_responsavel_id: v || null,
                    })
                  }
                >
                  <SelectTrigger className="h-8 flex-1">
                    <SelectValue placeholder="Atribuir pastor..." />
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
            </div>
          </SheetHeader>

          <Tabs defaultValue="dados" className="flex-1 flex flex-col overflow-hidden">
            <TabsList className="mx-6 mt-4 grid grid-cols-4">
              <TabsTrigger value="dados" className="text-xs">
                <User className="h-3 w-3 mr-1" />
                Dados
              </TabsTrigger>
              <TabsTrigger value="prontuario" className="text-xs">
                <FileText className="h-3 w-3 mr-1" />
                Prontuário
              </TabsTrigger>
              <TabsTrigger value="evolucao" className="text-xs">
                <MessageSquare className="h-3 w-3 mr-1" />
                Evolução
              </TabsTrigger>
              <TabsTrigger value="agenda" className="text-xs">
                <Calendar className="h-3 w-3 mr-1" />
                Agenda
              </TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 p-6">
              {/* Tab Dados */}
              <TabsContent value="dados" className="mt-0 space-y-4">
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Nome</Label>
                    <span className="font-medium">{nome}</span>
                  </div>

                  {telefone && (
                    <div className="flex items-center justify-between">
                      <Label className="text-muted-foreground">Telefone</Label>
                      <span>{telefone}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Data de Abertura</Label>
                    <span>
                      {format(new Date(atendimento.created_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Origem</Label>
                    <Badge variant="outline">{atendimento.origem || "Não informada"}</Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Gravidade</Label>
                    {atendimento.gravidade && (
                      <Badge
                        variant="outline"
                        className={GRAVIDADE_COLORS[atendimento.gravidade]}
                      >
                        {GRAVIDADE_LABELS[atendimento.gravidade]}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-muted-foreground">Pastor Responsável</Label>
                    <span>{atendimento.pastor?.nome || "Não atribuído"}</span>
                  </div>

                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={atendimento.status || "PENDENTE"}
                      onValueChange={(v) =>
                        updateStatusMutation.mutate({
                          id: atendimento.id,
                          status: v as StatusEnum,
                        })
                      }
                    >
                      <SelectTrigger>
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
                </div>
              </TabsContent>

              {/* Tab Prontuário */}
              <TabsContent value="prontuario" className="mt-0 space-y-4">
                {atendimento.motivo_resumo && (
                  <div className="space-y-2">
                    <Label>Motivo / Resumo (IA)</Label>
                    <Card className="bg-muted/30">
                      <CardContent className="p-3">
                        <p className="text-sm">{atendimento.motivo_resumo}</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Tratamento de privacidade para conteúdo confidencial */}
                {isPastor && atendimento.conteudo_original && !isConteudoConfidencial && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-500" />
                      Conteúdo Original (Confidencial)
                    </Label>
                    <Card className="bg-orange-500/10 border-orange-500/30">
                      <CardContent className="p-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {atendimento.conteudo_original}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Alerta de conteúdo confidencial mascarado */}
                {isConteudoConfidencial && (
                  <Card className="bg-amber-500/10 border-amber-500/30">
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="p-2 rounded-full bg-amber-500/20">
                        <Lock className="h-5 w-5 text-amber-600" />
                      </div>
                      <div>
                        <p className="font-medium text-amber-700 dark:text-amber-400">
                          Conteúdo Restrito
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Este conteúdo é restrito ao Pastor Responsável pelo atendimento.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {!isPastor && !isConteudoConfidencial && (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <Lock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Conteúdo confidencial restrito a pastores</p>
                  </div>
                )}

                {atendimento.observacoes_internas && (
                  <div className="space-y-2">
                    <Label>Observações Internas</Label>
                    <Card className="bg-muted/30">
                      <CardContent className="p-3">
                        <p className="text-sm whitespace-pre-wrap">
                          {atendimento.observacoes_internas}
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </TabsContent>

              {/* Tab Evolução */}
              <TabsContent value="evolucao" className="mt-0 space-y-4">
                {/* Timeline de notas */}
                {atendimento.historico_evolucao && atendimento.historico_evolucao.length > 0 ? (
                  <div className="relative space-y-3">
                    {/* Linha vertical da timeline */}
                    <div className="absolute left-3 top-2 bottom-2 w-0.5 bg-border" />
                    
                    {(atendimento.historico_evolucao as EvolucaoNota[])
                      .slice()
                      .reverse()
                      .map((nota, idx) => (
                        <div key={idx} className="relative pl-8">
                          {/* Bolinha da timeline */}
                          <div className="absolute left-1.5 top-3 w-3 h-3 rounded-full bg-primary border-2 border-background" />
                          
                          <Card className="bg-muted/30">
                            <CardContent className="p-3">
                              <div className="flex justify-between text-xs text-muted-foreground mb-2">
                                <span className="font-medium text-foreground">{nota.autor}</span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(nota.data), "dd/MM/yyyy HH:mm", {
                                    locale: ptBR,
                                  })}
                                </span>
                              </div>
                              <p className="text-sm">{nota.texto}</p>
                            </CardContent>
                          </Card>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma nota de evolução ainda</p>
                    <p className="text-xs mt-1">Adicione a primeira nota abaixo</p>
                  </div>
                )}

                {/* Adicionar nova nota */}
                <div className="space-y-2 pt-4 border-t">
                  <Label>Nova Anotação</Label>
                  <Textarea
                    placeholder="Descreva a evolução do atendimento..."
                    value={novaNota}
                    onChange={(e) => setNovaNota(e.target.value)}
                    rows={3}
                  />
                  <Button
                    onClick={handleAdicionarNota}
                    disabled={!novaNota.trim() || addNotaMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Evolução
                  </Button>
                </div>
              </TabsContent>

              {/* Tab Agenda */}
              <TabsContent value="agenda" className="mt-0 space-y-4">
                {/* Agendamento atual */}
                {atendimento.data_agendamento && (
                  <Card className="bg-primary/10 border-primary/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-primary font-medium">
                        <Calendar className="h-5 w-5" />
                        <span>
                          {format(
                            new Date(atendimento.data_agendamento),
                            "EEEE, dd 'de' MMMM 'às' HH:mm",
                            { locale: ptBR }
                          )}
                        </span>
                      </div>
                      {atendimento.local_atendimento && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                          <MapPin className="h-4 w-4" />
                          <span>{atendimento.local_atendimento}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Formulário de agendamento */}
                <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                  <Label className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {atendimento.data_agendamento ? "Reagendar Atendimento" : "Agendar Atendimento"}
                  </Label>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Data e Hora</Label>
                    <Input
                      type="datetime-local"
                      value={novaDataAgendamento}
                      onChange={(e) => setNovaDataAgendamento(e.target.value)}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Local / Link</Label>
                    <Input
                      placeholder="Sala pastoral, Google Meet, etc."
                      value={localAtendimento}
                      onChange={(e) => setLocalAtendimento(e.target.value)}
                    />
                  </div>
                  
                  <Button
                    onClick={handleAgendar}
                    disabled={!novaDataAgendamento || agendarMutation.isPending}
                    className="w-full"
                  >
                    <Calendar className="h-4 w-4 mr-2" />
                    Confirmar Agendamento
                  </Button>
                  
                  <p className="text-xs text-muted-foreground text-center">
                    O status será alterado automaticamente para "Agendado"
                  </p>
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* Dialog para confirmar mudança de status ao adicionar nota */}
      <AlertDialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar Acompanhamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Este atendimento está com status "Pendente". Ao adicionar uma nota de evolução, 
              deseja alterar o status para "Em Acompanhamento"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => handleConfirmStatusChange(false)}>
              Não, manter pendente
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmStatusChange(true)}>
              Sim, iniciar acompanhamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
