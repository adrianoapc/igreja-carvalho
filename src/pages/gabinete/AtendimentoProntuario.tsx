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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CompletarCadastroDialog } from "@/components/gabinete/CompletarCadastroDialog";

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
  BAIXA: "bg-green-500/20 text-green-700 border-green-500/30",
  MEDIA: "bg-yellow-500/20 text-yellow-700 border-yellow-500/30",
  ALTA: "bg-orange-500/20 text-orange-700 border-orange-500/30",
  CRITICA: "bg-red-500/20 text-red-700 border-red-500/30",
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

  const [novaNota, setNovaNota] = useState("");
  const [showStatusChangeDialog, setShowStatusChangeDialog] = useState(false);
  const [pendingNota, setPendingNota] = useState<EvolucaoNota | null>(null);
  const [showCadastroDialog, setShowCadastroDialog] = useState(false);

  const isPastor = hasAccess('pastoral', 'acesso_completo') || hasAccess('admin', 'acesso_completo');

  // Fetch atendimento
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

  // Fetch pastores
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

  // Mutations
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
      const updateData: Record<string, any> = { historico_evolucao: novoHistorico };
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
      if (variables.mudarStatus) {
        toast.success("Nota adicionada e status alterado!");
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

  // Handlers
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

  // Computed values
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
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64 lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (!atendimento) {
    return (
      <div className="p-4 md:p-6">
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
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/gabinete")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Prontuário
            </h1>
            <p className="text-muted-foreground text-sm">Sessão de Atendimento Pastoral</p>
          </div>
        </div>

        {/* Pastor Selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Pastor:</span>
          <Select
            value={atendimento.pastor_responsavel_id || ""}
            onValueChange={(v) => updatePastorMutation.mutate(v || null)}
          >
            <SelectTrigger className="w-[180px]">
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

      {/* Cabeçalho Adaptativo */}
      <Card className={cn(
        "border-l-4",
        atendimento.gravidade === "CRITICA" && "border-l-red-500",
        atendimento.gravidade === "ALTA" && "border-l-orange-500",
        atendimento.gravidade === "MEDIA" && "border-l-yellow-500",
        atendimento.gravidade === "BAIXA" && "border-l-green-500",
        !atendimento.gravidade && "border-l-muted"
      )}>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-16 w-16">
                <AvatarFallback className={cn(
                  "text-lg",
                  isMembro ? "bg-primary/20 text-primary" : "bg-amber-500/20 text-amber-700"
                )}>
                  {getInitials(nome)}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">{nome}</h2>
                  <Badge variant="outline" className={cn(
                    "text-xs",
                    isMembro 
                      ? "bg-primary/10 text-primary border-primary/30" 
                      : "bg-amber-500/10 text-amber-700 border-amber-500/30"
                  )}>
                    {isMembro ? "Membro" : "Visitante"}
                  </Badge>
                  {atendimento.gravidade && (
                    <Badge
                      variant="outline"
                      className={cn("text-xs", GRAVIDADE_COLORS[atendimento.gravidade])}
                    >
                      {GRAVIDADE_LABELS[atendimento.gravidade]}
                    </Badge>
                  )}
                </div>
                {isMembro && (
                  <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                    {idade !== null && <span>{idade} anos</span>}
                    {pessoa?.estado_civil && <span>• {pessoa.estado_civil}</span>}
                    <Link
                      to={`/pessoas/${pessoa?.id}`}
                      className="text-primary hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver perfil
                    </Link>
                  </div>
                )}
                {!isMembro && (
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-muted-foreground">
                      {telefone || "Sem telefone"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowCadastroDialog(true)}
                    >
                      <UserPlus className="h-3 w-3 mr-1" />
                      Completar Cadastro
                    </Button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Aberto em {format(new Date(atendimento.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de Conteúdo */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coluna Esquerda - Contexto */}
        <div className="space-y-4">
          {/* Queixa Principal */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Queixa Principal
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {atendimento.motivo_resumo && (
                <div className="bg-muted/50 p-3 rounded-lg">
                  <p className="text-sm font-medium">Resumo (IA)</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {atendimento.motivo_resumo}
                  </p>
                </div>
              )}

              {/* Conteúdo Original com tratamento de privacidade */}
              {isConteudoConfidencial && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-lg flex items-center gap-3">
                  <Lock className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-700">Conteúdo Restrito</p>
                    <p className="text-xs text-muted-foreground">
                      Restrito ao Pastor Responsável
                    </p>
                  </div>
                </div>
              )}

              {isPastor && atendimento.conteudo_original && !isConteudoConfidencial && (
                <div className="bg-orange-500/10 border border-orange-500/30 p-3 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <p className="text-sm font-medium text-orange-700">Conteúdo Original</p>
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {atendimento.conteudo_original}
                  </p>
                </div>
              )}

              <div className="text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  Origem: {atendimento.origem || "Não informada"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Dados de Contato */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                Dados de Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {telefone && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{telefone}</span>
                  </div>
                  {formatWhatsAppLink(telefone) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      asChild
                    >
                      <a
                        href={formatWhatsAppLink(telefone)!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        WhatsApp
                      </a>
                    </Button>
                  )}
                </div>
              )}

              {email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{email}</span>
                </div>
              )}

              {!telefone && !email && (
                <p className="text-sm text-muted-foreground">Nenhum contato registrado</p>
              )}

              {atendimento.data_agendamento && (
                <Separator />
              )}

              {atendimento.data_agendamento && (
                <div className="bg-sky-500/10 p-3 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-sky-600" />
                    <span className="text-sm font-medium text-sky-700">Agendamento</span>
                  </div>
                  <p className="text-sm mt-1">
                    {format(new Date(atendimento.data_agendamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {atendimento.local_atendimento && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {atendimento.local_atendimento}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna Direita - Sessão */}
        <div className="lg:col-span-2 space-y-4">
          {/* Timeline de Evolução */}
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Histórico de Evolução
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px] pr-4">
                {(!atendimento.historico_evolucao || atendimento.historico_evolucao.length === 0) ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma evolução registrada</p>
                    <p className="text-xs">Adicione a primeira nota abaixo</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {(atendimento.historico_evolucao as EvolucaoNota[])
                      .slice()
                      .reverse()
                      .map((nota, index) => (
                        <div key={index} className="relative pl-6 pb-4 border-l-2 border-muted last:pb-0">
                          <div className="absolute -left-2 top-0 h-4 w-4 rounded-full bg-primary" />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-medium text-foreground">{nota.autor}</span>
                              <span>•</span>
                              <span>
                                {format(new Date(nota.data), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </span>
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
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Anotações da Sessão Atual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="Descreva as observações, orientações e próximos passos..."
                value={novaNota}
                onChange={(e) => setNovaNota(e.target.value)}
                rows={4}
                className="resize-none"
              />

              <div className="flex flex-col sm:flex-row gap-2 justify-end">
                <Button
                  variant="outline"
                  onClick={() => encerrarMutation.mutate()}
                  disabled={encerrarMutation.isPending}
                  className="text-green-600 border-green-300 hover:bg-green-50"
                >
                  {encerrarMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Encerrar Atendimento
                </Button>
                <Button
                  onClick={handleAdicionarNota}
                  disabled={!novaNota.trim() || addNotaMutation.isPending}
                >
                  {addNotaMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <MessageSquare className="h-4 w-4 mr-2" />
                  )}
                  Salvar Evolução
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog para mudar status */}
      <AlertDialog open={showStatusChangeDialog} onOpenChange={setShowStatusChangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Iniciar Acompanhamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Este atendimento está com status "Pendente". Deseja alterar para "Em Acompanhamento"?
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
