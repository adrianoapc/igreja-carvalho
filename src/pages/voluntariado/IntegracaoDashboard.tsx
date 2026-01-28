import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useFilialId } from "@/hooks/useFilialId";
import { useToast } from "@/hooks/use-toast";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Calendar,
  ClipboardList,
} from "lucide-react";

interface Integracao {
  id: string;
  status: "entrevista" | "trilha" | "mentoria" | "teste" | "ativo" | "rejeitado";
  percentual_jornada: number;
  data_jornada_iniciada: string | null;
  data_conclusao_esperada: string | null;
  resultado_teste: "aprovado" | "reprovado" | "pendente" | null;
  candidato: {
    id: string;
    pessoa: {
      nome: string;
      telefone: string | null;
    };
    ministerio: string;
  };
  mentor: {
    nome: string;
  } | null;
  jornada: {
    titulo: string;
  } | null;
}

interface Mentor {
  id: string;
  nome: string;
}

export default function IntegracaoDashboard() {
  const { toast } = useToast();
  const { profile } = useAuth();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [ministerioFilter, setMinisterioFilter] = useState<string>("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedIntegracao, setSelectedIntegracao] = useState<Integracao | null>(null);
  const [assignMentorOpen, setAssignMentorOpen] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState<string>("");

  // Query para estatísticas
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["integracao-stats", igrejaId, filialId],
    queryFn: async () => {
      if (!igrejaId) return null;


      let query = supabase
        .from("integracao_voluntario")
        .select("id, status", { count: "exact" })
        .eq("igreja_id", igrejaId);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const byStatus = {
        entrevista: 0,
        trilha: 0,
        mentoria: 0,
        teste: 0,
        ativo: 0,
        rejeitado: 0,
      };

      (data || []).forEach((item) => {
        const s = item.status as keyof typeof byStatus;
        if (s in byStatus) byStatus[s]++;
      });

      return {
        total: count || 0,
        ...byStatus,
        emProcesso: byStatus.entrevista + byStatus.trilha + byStatus.mentoria + byStatus.teste,
      };
    },
    enabled: !!igrejaId,
  });

  // Query para listar integrações
  const { data: integracoes, isLoading } = useQuery({
    queryKey: ["integracoes", igrejaId, filialId, statusFilter, ministerioFilter],
    queryFn: async () => {
      if (!igrejaId) return [];


      let query = supabase
        .from("integracao_voluntario")
        .select(
          `
          id,
          status,
          percentual_jornada,
          data_jornada_iniciada,
          data_conclusao_esperada,
          resultado_teste,
          candidato:candidatos_voluntario!integracao_voluntario_candidato_id_fkey (
            id,
            ministerio,
            pessoa:profiles!candidatos_voluntario_pessoa_id_fkey (nome, telefone)
          ),
          mentor:profiles!integracao_voluntario_mentor_id_fkey (nome),
          jornada:jornadas!integracao_voluntario_jornada_id_fkey (titulo)
        `
        )
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false });

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = (data as unknown as Integracao[]) || [];

      if (ministerioFilter !== "all") {
        filtered = filtered.filter(
          (i) => i.candidato?.ministerio === ministerioFilter
        );
      }

      return filtered;
    },
    enabled: !!igrejaId,
  });

  // Query para buscar mentores disponíveis
  const { data: mentores } = useQuery({
    queryKey: ["mentores-disponiveis", igrejaId, filialId],
    queryFn: async () => {
      if (!igrejaId) return [];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("id, nome")
        .eq("igreja_id", igrejaId)
        .eq("ativo", true)
        .order("nome");

      if (error) throw error;
      
      let filtered = (data || []) as Mentor[];
      if (!isAllFiliais && filialId) {
        filtered = filtered.filter(m => (m as unknown as Record<string, string>).filial_id === filialId);
      }
      return filtered;
    },
    enabled: !!igrejaId,
  });

  // Mutation para atribuir mentor
  const assignMentorMutation = useMutation({
    mutationFn: async ({ integracaoId, mentorId }: { integracaoId: string; mentorId: string }) => {

      const { error } = await supabase
        .from("integracao_voluntario")
        .update({ mentor_id: mentorId })
        .eq("id", integracaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      toast({ title: "Mentor atribuído com sucesso!" });
      setAssignMentorOpen(false);
      setSelectedMentorId("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atribuir mentor",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation para avançar status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ integracaoId, newStatus }: { integracaoId: string; newStatus: string }) => {

      const { error } = await supabase
        .from("integracao_voluntario")
        .update({ status: newStatus })
        .eq("id", integracaoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integracoes"] });
      queryClient.invalidateQueries({ queryKey: ["integracao-stats"] });
      toast({ title: "Status atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar status",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAssignMentor = (integracao: Integracao) => {
    setSelectedIntegracao(integracao);
    setAssignMentorOpen(true);
  };

  const handleConfirmMentor = () => {
    if (!selectedIntegracao || !selectedMentorId) return;
    assignMentorMutation.mutate({
      integracaoId: selectedIntegracao.id,
      mentorId: selectedMentorId,
    });
  };

  const handleAdvanceStatus = (integracaoId: string, currentStatus: string) => {
    const statusFlow = ["entrevista", "trilha", "mentoria", "teste", "ativo"];
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex < statusFlow.length - 1) {
      const newStatus = statusFlow[currentIndex + 1];
      updateStatusMutation.mutate({ integracaoId, newStatus });
    }
  };

  const handleReject = (integracaoId: string) => {
    if (confirm("Tem certeza que deseja rejeitar este candidato?")) {
      updateStatusMutation.mutate({ integracaoId, newStatus: "rejeitado" });
    }
  };

  const statusLabels = {
    entrevista: "Entrevista",
    trilha: "Trilha",
    mentoria: "Mentoria",
    teste: "Teste",
    ativo: "Ativo",
    rejeitado: "Rejeitado",
  };

  const statusColors = {
    entrevista: "bg-blue-100 text-blue-800",
    trilha: "bg-purple-100 text-purple-800",
    mentoria: "bg-orange-100 text-orange-800",
    teste: "bg-yellow-100 text-yellow-800",
    ativo: "bg-green-100 text-green-800",
    rejeitado: "bg-red-100 text-red-800",
  };

  const ministerios = Array.from(
    new Set(integracoes?.map((i) => i.candidato?.ministerio).filter(Boolean) || [])
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Integração de Voluntários</h1>
        <p className="text-muted-foreground">
          Acompanhe o progresso dos candidatos no fluxo de integração
        </p>
      </div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Em Processo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {statsLoading ? "-" : stats?.emProcesso || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Aguardando Teste
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-orange-600">
              {statsLoading ? "-" : stats?.teste || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {statsLoading ? "-" : stats?.ativo || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <XCircle className="h-4 w-4" />
              Rejeitados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-600">
              {statsLoading ? "-" : stats?.rejeitado || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="entrevista">Entrevista</SelectItem>
                <SelectItem value="trilha">Trilha</SelectItem>
                <SelectItem value="mentoria">Mentoria</SelectItem>
                <SelectItem value="teste">Teste</SelectItem>
                <SelectItem value="ativo">Ativo</SelectItem>
                <SelectItem value="rejeitado">Rejeitado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1">
            <Label>Ministério</Label>
            <Select value={ministerioFilter} onValueChange={setMinisterioFilter}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {ministerios.map((ministerio) => (
                  <SelectItem key={ministerio} value={ministerio}>
                    {ministerio}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Tabela de Integrações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Candidatos em Integração
          </CardTitle>
          <CardDescription>
            {integracoes?.length || 0} candidato(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : integracoes && integracoes.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Candidato</TableHead>
                    <TableHead>Ministério</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progresso</TableHead>
                    <TableHead>Mentor</TableHead>
                    <TableHead>Prazo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {integracoes.map((integracao) => (
                    <TableRow key={integracao.id}>
                      <TableCell className="font-medium">
                        {Array.isArray(integracao.candidato?.pessoa)
                          ? integracao.candidato.pessoa[0]?.nome
                          : integracao.candidato?.pessoa?.nome}
                      </TableCell>
                      <TableCell>{integracao.candidato?.ministerio}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={statusColors[integracao.status]}
                        >
                          {statusLabels[integracao.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress
                            value={integracao.percentual_jornada}
                            className="w-20"
                          />
                          <span className="text-xs text-muted-foreground">
                            {integracao.percentual_jornada}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {Array.isArray(integracao.mentor)
                          ? integracao.mentor[0]?.nome || "-"
                          : integracao.mentor?.nome || "-"}
                      </TableCell>
                      <TableCell>
                        {integracao.data_conclusao_esperada ? (
                          <div className="flex items-center gap-1 text-xs">
                            <Calendar className="h-3 w-3" />
                            {new Date(
                              integracao.data_conclusao_esperada
                            ).toLocaleDateString("pt-BR")}
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {!integracao.mentor && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAssignMentor(integracao)}
                            >
                              Atribuir Mentor
                            </Button>
                          )}
                          {integracao.status !== "ativo" &&
                            integracao.status !== "rejeitado" && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() =>
                                    handleAdvanceStatus(
                                      integracao.id,
                                      integracao.status
                                    )
                                  }
                                >
                                  Avançar
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleReject(integracao.id)}
                                >
                                  Rejeitar
                                </Button>
                              </>
                            )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum candidato em processo de integração no momento.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para atribuir mentor */}
      <Dialog open={assignMentorOpen} onOpenChange={setAssignMentorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atribuir Mentor</DialogTitle>
            <DialogDescription>
              Selecione um mentor para acompanhar{" "}
              {Array.isArray(selectedIntegracao?.candidato?.pessoa)
                ? selectedIntegracao?.candidato.pessoa[0]?.nome
                : selectedIntegracao?.candidato?.pessoa?.nome}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Mentor</Label>
              <Select value={selectedMentorId} onValueChange={setSelectedMentorId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um mentor" />
                </SelectTrigger>
                <SelectContent>
                  {mentores?.map((mentor) => (
                    <SelectItem key={mentor.id} value={mentor.id}>
                      {mentor.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setAssignMentorOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmMentor}
                disabled={!selectedMentorId || assignMentorMutation.isPending}
              >
                {assignMentorMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
