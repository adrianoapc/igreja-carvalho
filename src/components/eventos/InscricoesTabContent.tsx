import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  Search, 
  MoreHorizontal, 
  CheckCircle, 
  XCircle,
  Clock,
  DollarSign,
  Loader2,
  UserPlus,
  Eye,
  UserPen,
  AlertCircle,
  LogIn,
  LogOut,
  Bell,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AdicionarInscricaoDialog } from "./AdicionarInscricaoDialog";
import { CompletarCadastroInscritoDialog } from "./CompletarCadastroInscritoDialog";

interface Evento {
  id: string;
  titulo: string;
  requer_pagamento: boolean | null;
  valor_inscricao: number | null;
  vagas_limite: number | null;
  categoria_financeira_id: string | null;
  conta_financeira_id: string | null;
}

interface Lote {
  id: string;
  nome: string;
  valor: number;
}

interface Inscricao {
  id: string;
  pessoa_id: string;
  status_pagamento: string;
  created_at: string;
  observacoes: string | null;
  transacao_id: string | null;
  lote_id: string | null;
  valor_pago: number | null;
  pessoa: {
    id: string;
    nome: string;
    email: string | null;
    telefone: string | null;
    avatar_url: string | null;
  };
  lote?: Lote | null;
}

interface InscricoesTabContentProps {
  eventoId: string;
  evento?: Evento | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pendente: { label: "Pendente", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock },
  pago: { label: "Pago", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle },
  isento: { label: "Isento", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: CheckCircle },
  cancelado: { label: "Cancelado", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
};

export default function InscricoesTabContent({ eventoId, evento }: InscricoesTabContentProps) {
  const navigate = useNavigate();
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [checkins, setCheckins] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingPessoaId, setEditingPessoaId] = useState<string | null>(null);
  const [sendingLembrete, setSendingLembrete] = useState(false);

  useEffect(() => {
    loadInscricoes();
    loadCheckins();
  }, [eventoId]);

  const loadInscricoes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("inscricoes_eventos")
        .select(`
          *,
          pessoa:profiles!inscricoes_eventos_pessoa_id_fkey (
            id, nome, email, telefone, avatar_url
          ),
          lote:evento_lotes (
            id, nome, valor
          )
        `)
        .eq("evento_id", eventoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setInscricoes((data as unknown as Inscricao[]) || []);
    } catch (error) {
      toast.error("Erro ao carregar inscrições");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadCheckins = async () => {
    try {
      const { data, error } = await supabase
        .from("checkins")
        .select("pessoa_id")
        .eq("evento_id", eventoId);

      if (error) throw error;
      setCheckins(new Set((data || []).map(c => c.pessoa_id)));
    } catch (error) {
      console.error("Erro ao carregar checkins:", error);
    }
  };

  const handleCheckin = async (pessoaId: string) => {
    setProcessingId(pessoaId);
    try {
      const { error } = await supabase
        .from("checkins")
        .insert({
          evento_id: eventoId,
          pessoa_id: pessoaId,
          metodo: "manual",
          tipo_registro: "checkin",
        });

      if (error) throw error;
      toast.success("Check-in realizado!");
      loadCheckins();
    } catch (error) {
      toast.error("Erro ao realizar check-in");
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleCancelCheckin = async (pessoaId: string) => {
    setProcessingId(pessoaId);
    try {
      const { error } = await supabase
        .from("checkins")
        .delete()
        .eq("evento_id", eventoId)
        .eq("pessoa_id", pessoaId);

      if (error) throw error;
      toast.success("Check-in cancelado!");
      loadCheckins();
    } catch (error) {
      toast.error("Erro ao cancelar check-in");
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleUpdateStatus = async (inscricaoId: string, novoStatus: string) => {
    setProcessingId(inscricaoId);
    try {
      const inscricao = inscricoes.find(i => i.id === inscricaoId);
      
      // Se está marcando como pago e evento requer pagamento, criar transação
      if (novoStatus === "pago" && evento?.requer_pagamento && !inscricao?.transacao_id) {
        // Usar valor do lote se existir, senão usar valor padrão do evento
        const valorInscricao = inscricao?.lote?.valor || evento.valor_inscricao || 0;
        const descricaoTx = inscricao?.lote 
          ? `Inscrição - ${evento.titulo} (${inscricao.lote.nome})`
          : `Inscrição - ${evento.titulo}`;

        const { data: transacao, error: txError } = await supabase
          .from("transacoes_financeiras")
          .insert({
            tipo: "entrada",
            tipo_lancamento: "avulso",
            descricao: descricaoTx,
            valor: valorInscricao,
            data_vencimento: new Date().toISOString().split("T")[0],
            data_pagamento: new Date().toISOString().split("T")[0],
            data_competencia: new Date().toISOString().split("T")[0],
            status: "pago",
            conta_id: evento.conta_financeira_id,
            categoria_id: evento.categoria_financeira_id,
          })
          .select()
          .single();

        if (txError) throw txError;

        await supabase
          .from("inscricoes_eventos")
          .update({ 
            status_pagamento: novoStatus,
            transacao_id: transacao.id,
            valor_pago: valorInscricao,
          })
          .eq("id", inscricaoId);
      } else {
        await supabase
          .from("inscricoes_eventos")
          .update({ status_pagamento: novoStatus })
          .eq("id", inscricaoId);
      }

      toast.success("Status atualizado!");
      loadInscricoes();
    } catch (error) {
      toast.error("Erro ao atualizar status");
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRemoveInscricao = async (inscricaoId: string) => {
    if (!confirm("Deseja remover esta inscrição?")) return;
    
    setProcessingId(inscricaoId);
    try {
      const { error } = await supabase
        .from("inscricoes_eventos")
        .delete()
        .eq("id", inscricaoId);

      if (error) throw error;
      toast.success("Inscrição removida");
      loadInscricoes();
    } catch (error) {
      toast.error("Erro ao remover inscrição");
      console.error(error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleEnviarLembrete = async () => {
    const elegíveis = inscricoes.filter(i => 
      i.status_pagamento === "pago" || i.status_pagamento === "isento" || !evento?.requer_pagamento
    ).length;

    if (!confirm(`Enviar lembrete para ${elegíveis} inscrito(s)?`)) return;

    setSendingLembrete(true);
    try {
      const { data, error } = await supabase.functions.invoke("inscricoes-lembrete-evento", {
        body: { evento_id: eventoId },
      });

      if (error) throw error;

      toast.success(`${data?.lembretesEnviados || 0} lembrete(s) enviado(s)!`);
    } catch (error) {
      toast.error("Erro ao enviar lembretes");
      console.error(error);
    } finally {
      setSendingLembrete(false);
    }
  };

  const filteredInscricoes = inscricoes.filter(i => 
    i.pessoa?.nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.pessoa?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: inscricoes.length,
    confirmados: inscricoes.filter(i => i.status_pagamento === "pago" || i.status_pagamento === "isento").length,
    pendentes: inscricoes.filter(i => i.status_pagamento === "pendente").length,
    valorTotal: inscricoes
      .filter(i => i.status_pagamento === "pago")
      .reduce((acc, i) => {
        // Usa valor_pago se disponível, senão usa valor do lote ou valor padrão do evento
        const valor = i.valor_pago || i.lote?.valor || evento?.valor_inscricao || 0;
        return acc + valor;
      }, 0),
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Confirmados</p>
              <p className="text-xl font-bold">{stats.confirmados}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-yellow-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pendentes</p>
              <p className="text-xl font-bold">{stats.pendentes}</p>
            </div>
          </CardContent>
        </Card>
        {evento?.requer_pagamento && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Arrecadado</p>
                <p className="text-xl font-bold">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(stats.valorTotal)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Lista */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Inscritos</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleEnviarLembrete} disabled={sendingLembrete || inscricoes.length === 0}>
              {sendingLembrete ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Enviar Lembrete
            </Button>
            <Button onClick={() => setShowAddDialog(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Adicionar Inscrito
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Buscar por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          {filteredInscricoes.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma inscrição encontrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Participante</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Lote / Valor</TableHead>
                  <TableHead>Data Inscrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInscricoes.map((inscricao) => {
                  const statusConfig = STATUS_CONFIG[inscricao.status_pagamento] || STATUS_CONFIG.pendente;
                  const StatusIcon = statusConfig.icon;
                  const valorInscricao = inscricao.valor_pago || inscricao.lote?.valor || evento?.valor_inscricao || 0;
                  
                  return (
                    <TableRow key={inscricao.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={inscricao.pessoa?.avatar_url || undefined} />
                            <AvatarFallback>
                              {inscricao.pessoa?.nome?.charAt(0) || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{inscricao.pessoa?.nome}</span>
                          {checkins.has(inscricao.pessoa_id) ? (
                            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 text-[10px] px-1.5 py-0">
                              <LogIn className="h-3 w-3 mr-0.5" />
                              Check-in
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                              Pendente
                            </Badge>
                          )}
                          {!inscricao.pessoa?.email && !inscricao.pessoa?.telefone && (
                            <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <p>{inscricao.pessoa?.email || "—"}</p>
                          <p className="text-muted-foreground">{inscricao.pessoa?.telefone || "—"}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {inscricao.lote ? (
                            <>
                              <p className="font-medium">{inscricao.lote.nome}</p>
                              <p className="text-muted-foreground">
                                {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorInscricao)}
                              </p>
                            </>
                          ) : evento?.requer_pagamento ? (
                            <p className="text-muted-foreground">
                              {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valorInscricao)}
                            </p>
                          ) : (
                            <p className="text-muted-foreground">—</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(inscricao.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusConfig.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {statusConfig.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={processingId === inscricao.id || processingId === inscricao.pessoa_id}>
                              {(processingId === inscricao.id || processingId === inscricao.pessoa_id) ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="z-50">
                            <DropdownMenuItem onClick={() => navigate(`/pessoas/${inscricao.pessoa_id}`)}>
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Perfil
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setEditingPessoaId(inscricao.pessoa_id)}>
                              <UserPen className="h-4 w-4 mr-2" />
                              Completar Cadastro
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {checkins.has(inscricao.pessoa_id) ? (
                              <DropdownMenuItem onClick={() => handleCancelCheckin(inscricao.pessoa_id)}>
                                <LogOut className="h-4 w-4 mr-2 text-orange-500" />
                                Cancelar Check-in
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleCheckin(inscricao.pessoa_id)}>
                                <LogIn className="h-4 w-4 mr-2 text-green-500" />
                                Fazer Check-in
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {evento?.requer_pagamento && inscricao.status_pagamento !== "pago" && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(inscricao.id, "pago")}>
                                <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                                Confirmar Pagamento
                              </DropdownMenuItem>
                            )}
                            {inscricao.status_pagamento !== "isento" && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(inscricao.id, "isento")}>
                                <CheckCircle className="h-4 w-4 mr-2 text-blue-500" />
                                Marcar como Isento
                              </DropdownMenuItem>
                            )}
                            {inscricao.status_pagamento !== "cancelado" && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(inscricao.id, "cancelado")}>
                                <XCircle className="h-4 w-4 mr-2 text-red-500" />
                                Cancelar Inscrição
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem 
                              onClick={() => handleRemoveInscricao(inscricao.id)}
                              className="text-destructive"
                            >
                              Remover
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AdicionarInscricaoDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        eventoId={eventoId}
        evento={evento}
        onSuccess={loadInscricoes}
      />

      <CompletarCadastroInscritoDialog
        pessoaId={editingPessoaId}
        open={!!editingPessoaId}
        onOpenChange={(open) => { if (!open) setEditingPessoaId(null); }}
        onSuccess={loadInscricoes}
      />
    </div>
  );
}
