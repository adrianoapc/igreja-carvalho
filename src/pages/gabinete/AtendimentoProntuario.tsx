import { useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
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
import { format, differenceInYears } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  MessageSquare,
  Lock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  UserPlus,
  Clock,
  FileText,
  Send,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompletarCadastroDialog } from "@/components/gabinete/CompletarCadastroDialog";
import { useIsMobile } from "@/hooks/use-mobile";

type GravidadeEnum = "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
type StatusEnum = "PENDENTE" | "TRIAGEM" | "AGENDADO" | "EM_ACOMPANHAMENTO" | "CONCLUIDO";

interface EvolucaoNota {
  data: string;
  autor: string;
  texto: string;
}

interface AtendimentoCompleto {
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
  historico_evolucao: EvolucaoNota[] | null;
  pessoa?: {
    id: string;
    nome: string | null;
    telefone: string | null;
    email: string | null;
    avatar_url: string | null;
    data_nascimento: string | null;
    estado_civil: string | null;
  } | null;
  visitante?: {
    id: string;
    nome: string | null;
    telefone: string | null;
    email: string | null;
  } | null;
  pastor?: { id: string; nome: string | null } | null;
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

export default function AtendimentoProntuario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, hasAccess } = useAuth();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const [novaNota, setNovaNota] = useState("");
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [pendingNota, setPendingNota] = useState<EvolucaoNota | null>(null);
  const [showCadastroDialog, setShowCadastroDialog] = useState(false);

  const isPastor = hasAccess('pastoral', 'acesso_completo') || hasAccess('admin', 'acesso_completo');

  const { data: atendimento, isLoading } = useQuery({
    queryKey: ["atendimento-pastoral", id],
    queryFn: async () => {
      if (!id) throw new Error("ID não informado");

      const { data, error } = await supabase
        .from("atendimentos_pastorais")
        .select(`
          *,
          pessoa:profiles!atendimentos_pastorais_pessoa_id_fkey(
            id, nome, telefone, email, avatar_url, data_nascimento, estado_civil
          ),
          visitante:visitantes_leads!atendimentos_pastorais_visitante_id_fkey(
            id, nome, telefone, email
          ),
          pastor:profiles!atendimentos_pastorais_pastor_responsavel_id_fkey(id, nome)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data as unknown as AtendimentoCompleto;
    },
    enabled: !!id,
  });

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

  const updatePastorMutation = useMutation({
    mutationFn: async (pastor_responsavel_id: string | null) => {
      if (!id) throw new Error("ID não informado");
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({ pastor_responsavel_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimento-pastoral", id] });
      toast.success("Pastor responsável atualizado!");
    },
    onError: () => {
      toast.error("Erro ao atualizar pastor");
    },
  });

  const addNotaMutation = useMutation({
    mutationFn: async ({
      nota,
      historicoAtual,
      mudarStatus,
    }: {
      nota: EvolucaoNota;
      historicoAtual: EvolucaoNota[];
      mudarStatus?: boolean;
    }) => {
      if (!id) throw new Error("ID não informado");
      const novoHistorico = [...historicoAtual, nota];
      const updateData: Record<string, unknown> = { historico_evolucao: novoHistorico };
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
      queryClient.invalidateQueries({ queryKey: ["atendimento-pastoral", id] });
      toast.success(variables.mudarStatus ? "Nota adicionada!" : "Nota adicionada!");
      setNovaNota("");
      setPendingNota(null);
    },
    onError: () => {
      toast.error("Erro ao adicionar nota");
    },
  });

  const encerrarMutation = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("ID não informado");
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({ status: "CONCLUIDO" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimento-pastoral", id] });
      toast.success("Atendimento encerrado!");
      navigate("/gabinete");
    },
    onError: () => {
      toast.error("Erro ao encerrar atendimento");
    },
  });

  const handleAdicionarNota = () => {
    if (!novaNota.trim() || !atendimento) return;

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
        nota,
        historicoAtual: (atendimento.historico_evolucao as EvolucaoNota[]) || [],
        mudarStatus: false,
      });
    }
  };

  const handleConfirmStatusChange = (mudarStatus: boolean) => {
    if (pendingNota && atendimento) {
      addNotaMutation.mutate({
        nota: pendingNota,
        historicoAtual: (atendimento.historico_evolucao as EvolucaoNota[]) || [],
        mudarStatus,
      });
    }
    setShowStatusChangeDialog(false);
  };

  const isConteudoConfidencial = atendimento?.conteudo_original === "CONFIDENCIAL";
  const isMembro = !!atendimento?.pessoa_id;
  const pessoa = atendimento?.pessoa;
  const visitante = atendimento?.visitante;
  const nome = pessoa?.nome || visitante?.nome || "Não identificado";
  const telefone = pessoa?.telefone || visitante?.telefone;
  const email = pessoa?.email || visitante?.email;

  const idade = useMemo(() => {
    if (!pessoa?.data_nascimento) return null;
    try {
      return differenceInYears(new Date(), new Date(pessoa.data_nascimento));
    } catch {
      return null;
    }
  }, [pessoa?.data_nascimento]);

  const getInitials = (nome: string | null) => {
    if (!nome) return "?";
    const parts = nome.split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return nome.substring(0, 2).toUpperCase();
  };

  const formatWhatsAppLink = (phone: string | null) => {
    if (!phone) return null;
    const cleaned = phone.replace(/\D/g, "");
    const formatted = cleaned.startsWith("55") ? cleaned : `55${cleaned}`;
    return `https://wa.me/${formatted}`;
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!atendimento) {
    return (
      <div className="p-4">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Atendimento não encontrado</h2>
          <Button variant="outline" onClick={() => navigate("/gabinete")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header Fixo */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate("/gabinete")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">Prontuário</span>
              </h1>
            </div>
            {!isMobile && (
              <Select
                value={atendimento.pastor_responsavel_id || ""}
                onValueChange={(v) => updatePastorMutation.mutate(v || null)}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Pastor..." />
                </SelectTrigger>
                <SelectContent>
                  {pastores.map((pastor) => (
                    <SelectItem key={pastor.id} value={pastor.id}>
                      {pastor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      </div>

      {/* Conteúdo Principal */}
      <div className="p-3 sm:p-4 space-y-4">
        {/* Card do Paciente */}
        <Card className={cn(
          "border-l-4",
          atendimento.gravidade === "CRITICA" && "border-l-red-500",
          atendimento.gravidade === "ALTA" && "border-l-orange-500",
          atendimento.gravidade === "MEDIA" && "border-l-amber-500",
          atendimento.gravidade === "BAIXA" && "border-l-emerald-500",
          !atendimento.gravidade && "border-l-muted"
        )}>
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12 shrink-0">
                <AvatarFallback className={cn(
                  "text-sm",
                  isMembro ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-700"
                )}>
                  {getInitials(nome)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold truncate">{nome}</h2>
                  <Badge variant="outline" className={cn(
                    "text-[10px] px-1.5 shrink-0",
                    isMembro 
                      ? "bg-primary/10 text-primary border-primary/30" 
                      : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                  )}>
                    {isMembro ? "Membro" : "Visitante"}
                  </Badge>
                  {atendimento.gravidade && (
                    <Badge
                      variant="outline"
                      className={cn("text-[10px] px-1.5 shrink-0", GRAVIDADE_COLORS[atendimento.gravidade])}
                    >
                      {GRAVIDADE_LABELS[atendimento.gravidade]}
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {isMembro && idade !== null && <span>{idade} anos</span>}
                  {isMembro && pessoa?.estado_civil && <span>• {pessoa.estado_civil}</span>}
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(atendimento.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>

                {/* Ações rápidas */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {isMembro && pessoa?.id && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" asChild>
                      <Link to={`/pessoas/${pessoa.id}`}>
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Ver perfil
                      </Link>
                    </Button>
                  )}
                  {!isMembro && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2"
                      onClick={() => setShowCadastroDialog(true)}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Cadastrar
                    </Button>
                  )}
                  {telefone && formatWhatsAppLink(telefone) && (
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" asChild>
                      <a href={formatWhatsAppLink(telefone)!} target="_blank" rel="noopener noreferrer">
                        <Phone className="h-3 w-3 mr-1" />
                        WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pastor Responsável (Mobile) */}
        {isMobile && (
          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground shrink-0">Pastor:</span>
                <Select
                  value={atendimento.pastor_responsavel_id || ""}
                  onValueChange={(v) => updatePastorMutation.mutate(v || null)}
                >
                  <SelectTrigger className="h-8 flex-1 text-sm">
                    <SelectValue placeholder="Selecionar..." />
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
            </CardContent>
          </Card>
        )}

        {/* Queixa Principal */}
        <Card>
          <CardHeader className="pb-2 px-3 pt-3 sm:px-4 sm:pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Queixa Principal
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-3">
            {atendimento.motivo_resumo && (
              <div className="bg-muted/50 p-3 rounded-lg">
                <p className="text-xs font-medium text-muted-foreground mb-1">Resumo (IA)</p>
                <p className="text-sm">{atendimento.motivo_resumo}</p>
              </div>
            )}

            {isConteudoConfidencial && (
              <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg flex items-center gap-3">
                <Lock className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Conteúdo Restrito</p>
                  <p className="text-xs text-muted-foreground">Restrito ao Pastor Responsável</p>
                </div>
              </div>
            )}

            {isPastor && atendimento.conteudo_original && !isConteudoConfidencial && (
              <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                  <p className="text-sm font-medium text-orange-700 dark:text-orange-400">Conteúdo Original</p>
                </div>
                <p className="text-sm whitespace-pre-wrap">{atendimento.conteudo_original}</p>
              </div>
            )}

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Origem: {atendimento.origem || "Não informada"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Dados de Contato & Agendamento */}
        <Card>
          <CardHeader className="pb-2 px-3 pt-3 sm:px-4 sm:pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Contato
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-3">
            <div className="grid gap-2">
              {telefone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{telefone}</span>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
              )}
              {!telefone && !email && (
                <p className="text-sm text-muted-foreground">Nenhum contato registrado</p>
              )}
            </div>

            {atendimento.data_agendamento && (
              <>
                <Separator />
                <div className="bg-sky-500/10 p-3 rounded-lg">
                  <div className="flex items-center gap-2 text-sky-700 dark:text-sky-400">
                    <Calendar className="h-4 w-4" />
                    <span className="text-sm font-medium">Agendamento</span>
                  </div>
                  <p className="text-sm mt-1">
                    {format(new Date(atendimento.data_agendamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {atendimento.local_atendimento && (
                    <p className="text-xs text-muted-foreground mt-1">{atendimento.local_atendimento}</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Histórico de Evolução */}
        <Card>
          <CardHeader className="pb-2 px-3 pt-3 sm:px-4 sm:pt-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Histórico de Evolução
              <Badge variant="secondary" className="ml-auto text-[10px]">
                {atendimento.historico_evolucao?.length || 0} notas
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
            <ScrollArea className={cn("pr-2", isMobile ? "h-[200px]" : "h-[280px]")}>
              {(!atendimento.historico_evolucao || atendimento.historico_evolucao.length === 0) ? (
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhuma evolução registrada</p>
                  <p className="text-xs">Adicione a primeira nota abaixo</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(atendimento.historico_evolucao as EvolucaoNota[])
                    .slice()
                    .reverse()
                    .map((nota, index) => (
                      <div key={index} className="relative pl-5 pb-3 border-l-2 border-muted last:pb-0">
                        <div className="absolute -left-1.5 top-0 h-3 w-3 rounded-full bg-primary" />
                        <div className="space-y-0.5">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                            <span className="font-medium text-foreground">{nota.autor}</span>
                            <span>•</span>
                            <span>{format(new Date(nota.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                          </div>
                          <p className="text-sm">{nota.texto}</p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de Registro */}
        <Card>
          <CardHeader className="pb-2 px-3 pt-3 sm:px-4 sm:pt-4">
            <CardTitle className="text-sm font-medium">Anotações da Sessão</CardTitle>
          </CardHeader>
          <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4 space-y-3">
            <Textarea
              placeholder="Descreva observações, orientações e próximos passos..."
              value={novaNota}
              onChange={(e) => setNovaNota(e.target.value)}
              rows={3}
              className="resize-none text-sm"
            />

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                onClick={() => encerrarMutation.mutate()}
                disabled={encerrarMutation.isPending}
                className="text-emerald-600 border-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950 flex-1 sm:flex-none"
              >
                {encerrarMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Encerrar
              </Button>
              <Button
                onClick={handleAdicionarNota}
                disabled={!novaNota.trim() || addNotaMutation.isPending}
                className="flex-1"
              >
                {addNotaMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Salvar Evolução
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialog para mudar status */}
      <AlertDialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar Acompanhamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Este atendimento está pendente. Deseja alterar para "Em Acompanhamento"?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={() => handleConfirmStatusChange(false)} className="w-full sm:w-auto">
              Manter Pendente
            </AlertDialogCancel>
            <AlertDialogAction onClick={() => handleConfirmStatusChange(true)} className="w-full sm:w-auto">
              Iniciar Acompanhamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog para completar cadastro */}
      <CompletarCadastroDialog
        visitanteId={atendimento.visitante_id}
        nomeAtual={visitante?.nome}
        open={showCadastroDialog}
        onOpenChange={setShowCadastroDialog}
      />
    </div>
  );
}
