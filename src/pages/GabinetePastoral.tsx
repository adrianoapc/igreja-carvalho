import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  Clock, 
  Calendar, 
  FileText, 
  User, 
  Filter, 
  Plus,
  AlertCircle,
  CheckCircle2,
  MessageSquare
} from "lucide-react";

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

const STATUS_COLUMNS: { status: StatusEnum; label: string; icon: React.ReactNode }[] = [
  { status: "PENDENTE", label: "Pendente", icon: <Clock className="h-4 w-4" /> },
  { status: "EM_ACOMPANHAMENTO", label: "Em Acompanhamento", icon: <MessageSquare className="h-4 w-4" /> },
  { status: "AGENDADO", label: "Agendado", icon: <Calendar className="h-4 w-4" /> },
  { status: "CONCLUIDO", label: "Concluído", icon: <CheckCircle2 className="h-4 w-4" /> },
];

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

export default function GabinetePastoral() {
  const { profile, hasAccess } = useAuth();
  const queryClient = useQueryClient();
  const [filtroMeus, setFiltroMeus] = useState(false);
  const [filtroGravidade, setFiltroGravidade] = useState<GravidadeEnum | "TODAS">("TODAS");
  const [selectedAtendimento, setSelectedAtendimento] = useState<AtendimentoPastoral | null>(null);
  const [novaNota, setNovaNota] = useState("");
  const [novaDataAgendamento, setNovaDataAgendamento] = useState("");
  
  // Verificar se é secretária (só pode ver agenda, não conteúdo sensível)
  const isSecretaria = hasAccess('secretaria', 'visualizar') && !hasAccess('pastoral', 'acesso_completo');
  const isPastor = hasAccess('pastoral', 'acesso_completo') || hasAccess('admin', 'acesso_completo');

  // Buscar atendimentos
  const { data: atendimentos, isLoading } = useQuery({
    queryKey: ["atendimentos-pastorais"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("atendimentos_pastorais")
        .select(`
          *,
          pessoa:profiles!atendimentos_pastorais_pessoa_id_fkey(nome, telefone),
          visitante:visitantes_leads!atendimentos_pastorais_visitante_id_fkey(nome, telefone),
          pastor:profiles!atendimentos_pastorais_pastor_responsavel_id_fkey(nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AtendimentoPastoral[];
    },
  });

  // Mutation para atualizar status
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
      toast.success("Status atualizado com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao atualizar status");
    },
  });

  // Mutation para agendar data
  const agendarMutation = useMutation({
    mutationFn: async ({ id, data_agendamento }: { id: string; data_agendamento: string }) => {
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({ 
          data_agendamento,
          status: "AGENDADO" as StatusEnum
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      toast.success("Agendamento salvo com sucesso!");
      setNovaDataAgendamento("");
    },
    onError: () => {
      toast.error("Erro ao salvar agendamento");
    },
  });

  // Mutation para adicionar nota de evolução
  const addNotaMutation = useMutation({
    mutationFn: async ({ id, nota, historicoAtual }: { id: string; nota: EvolucaoNota; historicoAtual: any[] }) => {
      const novoHistorico = [...(historicoAtual || []), nota];
      const { error } = await supabase
        .from("atendimentos_pastorais")
        .update({ historico_evolucao: novoHistorico })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["atendimentos-pastorais"] });
      toast.success("Nota adicionada com sucesso!");
      setNovaNota("");
    },
    onError: () => {
      toast.error("Erro ao adicionar nota");
    },
  });

  // Filtrar atendimentos
  const atendimentosFiltrados = useMemo(() => {
    if (!atendimentos) return [];
    
    return atendimentos.filter((a) => {
      // Filtro "Meus Atendimentos"
      if (filtroMeus && profile?.id && a.pastor_responsavel_id !== profile.id) {
        return false;
      }
      // Filtro Gravidade
      if (filtroGravidade !== "TODAS" && a.gravidade !== filtroGravidade) {
        return false;
      }
      return true;
    });
  }, [atendimentos, filtroMeus, filtroGravidade, profile?.id]);

  // Agrupar por status
  const atendimentosPorStatus = useMemo(() => {
    const grouped: Record<StatusEnum, AtendimentoPastoral[]> = {
      PENDENTE: [],
      TRIAGEM: [],
      AGENDADO: [],
      EM_ACOMPANHAMENTO: [],
      CONCLUIDO: [],
    };

    atendimentosFiltrados.forEach((a) => {
      const status = a.status || "PENDENTE";
      if (grouped[status]) {
        grouped[status].push(a);
      }
    });

    return grouped;
  }, [atendimentosFiltrados]);

  const getNomeIdentificado = (a: AtendimentoPastoral) => {
    return a.pessoa?.nome || a.visitante?.nome || "Não identificado";
  };

  const handleAdicionarNota = () => {
    if (!selectedAtendimento || !novaNota.trim()) return;
    
    const nota: EvolucaoNota = {
      data: new Date().toISOString(),
      autor: profile?.nome || "Sistema",
      texto: novaNota.trim(),
    };

    addNotaMutation.mutate({
      id: selectedAtendimento.id,
      nota,
      historicoAtual: selectedAtendimento.historico_evolucao || [],
    });
  };

  const handleAgendar = () => {
    if (!selectedAtendimento || !novaDataAgendamento) return;
    agendarMutation.mutate({
      id: selectedAtendimento.id,
      data_agendamento: novaDataAgendamento,
    });
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Painel Pastoral</h1>
          <p className="text-muted-foreground">Gestão de atendimentos pastorais</p>
        </div>
        
        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={filtroMeus ? "default" : "outline"}
            size="sm"
            onClick={() => setFiltroMeus(!filtroMeus)}
          >
            <User className="h-4 w-4 mr-2" />
            Meus Atendimentos
          </Button>
          
          <Select
            value={filtroGravidade}
            onValueChange={(v) => setFiltroGravidade(v as GravidadeEnum | "TODAS")}
          >
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Gravidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TODAS">Todas</SelectItem>
              <SelectItem value="BAIXA">Baixa</SelectItem>
              <SelectItem value="MEDIA">Média</SelectItem>
              <SelectItem value="ALTA">Alta</SelectItem>
              <SelectItem value="CRITICA">Crítica</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATUS_COLUMNS.map(({ status, label, icon }) => (
          <Card key={status} className="bg-muted/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                {icon}
                {label}
                <Badge variant="secondary" className="ml-auto">
                  {atendimentosPorStatus[status]?.length || 0}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="space-y-2 pr-2">
                  {atendimentosPorStatus[status]?.map((atendimento) => (
                    <Sheet key={atendimento.id}>
                      <SheetTrigger asChild>
                        <Card 
                          className="cursor-pointer hover:shadow-md transition-shadow"
                          onClick={() => setSelectedAtendimento(atendimento)}
                        >
                          <CardContent className="p-3 space-y-2">
                            {/* Nome e Gravidade */}
                            <div className="flex items-start justify-between gap-2">
                              <span className="font-medium text-sm truncate flex-1">
                                {getNomeIdentificado(atendimento)}
                              </span>
                              {atendimento.gravidade && (
                                <Badge 
                                  variant="outline" 
                                  className={`text-xs ${GRAVIDADE_COLORS[atendimento.gravidade]}`}
                                >
                                  {GRAVIDADE_LABELS[atendimento.gravidade]}
                                </Badge>
                              )}
                            </div>
                            
                            {/* Data */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {format(new Date(atendimento.created_at), "dd/MM/yyyy", { locale: ptBR })}
                            </div>
                            
                            {/* Motivo Resumo */}
                            {atendimento.motivo_resumo && (
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {atendimento.motivo_resumo}
                              </p>
                            )}

                            {/* Data de Agendamento */}
                            {atendimento.data_agendamento && (
                              <div className="flex items-center gap-1 text-xs text-primary">
                                <Calendar className="h-3 w-3" />
                                {format(new Date(atendimento.data_agendamento), "dd/MM 'às' HH:mm", { locale: ptBR })}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </SheetTrigger>
                      
                      {/* Sheet de Detalhes */}
                      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
                        <SheetHeader>
                          <SheetTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Prontuário
                          </SheetTitle>
                        </SheetHeader>
                        
                        <div className="mt-6 space-y-6">
                          {/* Informações Básicas */}
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <Label className="text-muted-foreground">Nome</Label>
                              <span className="font-medium">{getNomeIdentificado(atendimento)}</span>
                            </div>
                            
                            <div className="flex items-center justify-between">
                              <Label className="text-muted-foreground">Data</Label>
                              <span>{format(new Date(atendimento.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
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
                          </div>

                          {/* Alterar Status */}
                          <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                              value={atendimento.status || "PENDENTE"}
                              onValueChange={(v) => updateStatusMutation.mutate({ 
                                id: atendimento.id, 
                                status: v as StatusEnum 
                              })}
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

                          {/* Agendamento */}
                          <div className="space-y-2">
                            <Label>Agendar Atendimento</Label>
                            <div className="flex gap-2">
                              <Input
                                type="datetime-local"
                                value={novaDataAgendamento}
                                onChange={(e) => setNovaDataAgendamento(e.target.value)}
                              />
                              <Button 
                                onClick={handleAgendar}
                                disabled={!novaDataAgendamento || agendarMutation.isPending}
                              >
                                <Calendar className="h-4 w-4" />
                              </Button>
                            </div>
                            {atendimento.data_agendamento && (
                              <p className="text-xs text-muted-foreground">
                                Agendado para: {format(new Date(atendimento.data_agendamento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                              </p>
                            )}
                          </div>

                          {/* Conteúdo Original - Só para Pastor */}
                          {isPastor && atendimento.conteudo_original && (
                            <div className="space-y-2">
                              <Label className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-orange-500" />
                                Conteúdo Original (Confidencial)
                              </Label>
                              <Card className="bg-muted/50">
                                <CardContent className="p-3">
                                  <p className="text-sm whitespace-pre-wrap">
                                    {atendimento.conteudo_original}
                                  </p>
                                </CardContent>
                              </Card>
                            </div>
                          )}

                          {/* Notas de Evolução */}
                          <div className="space-y-2">
                            <Label>Notas de Evolução</Label>
                            
                            {/* Lista de notas existentes */}
                            {atendimento.historico_evolucao && atendimento.historico_evolucao.length > 0 && (
                              <div className="space-y-2 mb-4">
                                {(atendimento.historico_evolucao as EvolucaoNota[]).map((nota, idx) => (
                                  <Card key={idx} className="bg-muted/30">
                                    <CardContent className="p-2">
                                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                        <span>{nota.autor}</span>
                                        <span>{format(new Date(nota.data), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                                      </div>
                                      <p className="text-sm">{nota.texto}</p>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            )}
                            
                            {/* Adicionar nova nota */}
                            <Textarea
                              placeholder="Adicionar nota de evolução..."
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
                              Adicionar Nota
                            </Button>
                          </div>
                        </div>
                      </SheetContent>
                    </Sheet>
                  ))}
                  
                  {(!atendimentosPorStatus[status] || atendimentosPorStatus[status].length === 0) && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      Nenhum atendimento
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
