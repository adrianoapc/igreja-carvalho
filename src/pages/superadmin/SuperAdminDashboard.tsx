import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSuperAdmin, type Igreja, type OnboardingRequest, type TenantMetrica } from '@/hooks/useSuperAdmin';
import { useToast } from '@/hooks/use-toast';
import {
  Building2,
  Users,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  BarChart3,
  RefreshCw,
  Eye,
  TrendingUp,
  Database,
  Activity,
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    isSuperAdmin,
    loading,
    dashboard,
    igrejas,
    solicitacoes,
    loadDashboard,
    loadIgrejas,
    loadSolicitacoes,
    aprovarSolicitacao,
    rejeitarSolicitacao,
    atualizarStatusIgreja,
    calcularMetricas,
    loadMetricasTenant,
  } = useSuperAdmin();

  const [selectedIgreja, setSelectedIgreja] = useState<Igreja | null>(null);
  const [metricas, setMetricas] = useState<TenantMetrica[]>([]);
  const [loadingMetricas, setLoadingMetricas] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [rejectMotivo, setRejectMotivo] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      navigate('/');
      toast({
        title: 'Acesso negado',
        description: 'Você não tem permissão para acessar esta página',
        variant: 'destructive',
      });
    }
  }, [loading, isSuperAdmin, navigate, toast]);

  useEffect(() => {
    if (isSuperAdmin) {
      loadDashboard();
      loadIgrejas();
      loadSolicitacoes();
    }
  }, [isSuperAdmin, loadDashboard, loadIgrejas, loadSolicitacoes]);

  const handleViewMetricas = async (igreja: Igreja) => {
    setSelectedIgreja(igreja);
    setLoadingMetricas(true);
    const data = await loadMetricasTenant(igreja.id);
    setMetricas(data);
    setLoadingMetricas(false);
  };

  const handleRecalcularMetricas = async (igrejaId: string) => {
    setProcessing(true);
    const success = await calcularMetricas(igrejaId);
    if (success) {
      toast({ title: 'Métricas recalculadas com sucesso' });
      if (selectedIgreja?.id === igrejaId) {
        const data = await loadMetricasTenant(igrejaId);
        setMetricas(data);
      }
    } else {
      toast({ title: 'Erro ao recalcular métricas', variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleAprovar = async (id: string) => {
    setProcessing(true);
    const result = await aprovarSolicitacao(id);
    if (result.success) {
      toast({ title: 'Igreja criada com sucesso!', description: result.message });
    } else {
      toast({ title: 'Erro ao aprovar', description: result.message, variant: 'destructive' });
    }
    setProcessing(false);
  };

  const handleRejeitar = async () => {
    if (!rejectDialog.id) return;
    setProcessing(true);
    const success = await rejeitarSolicitacao(rejectDialog.id, rejectMotivo);
    if (success) {
      toast({ title: 'Solicitação rejeitada' });
    } else {
      toast({ title: 'Erro ao rejeitar', variant: 'destructive' });
    }
    setRejectDialog({ open: false, id: null });
    setRejectMotivo('');
    setProcessing(false);
  };

  const handleStatusChange = async (igrejaId: string, newStatus: string) => {
    setProcessing(true);
    const success = await atualizarStatusIgreja(igrejaId, newStatus);
    if (success) {
      toast({ title: `Status alterado para ${newStatus}` });
    } else {
      toast({ title: 'Erro ao alterar status', variant: 'destructive' });
    }
    setProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
      ativo: { variant: 'default', icon: <CheckCircle2 className="w-3 h-3" /> },
      pendente: { variant: 'secondary', icon: <Clock className="w-3 h-3" /> },
      suspenso: { variant: 'destructive', icon: <AlertCircle className="w-3 h-3" /> },
      inativo: { variant: 'outline', icon: <XCircle className="w-3 h-3" /> },
      aprovado: { variant: 'default', icon: <CheckCircle2 className="w-3 h-3" /> },
      rejeitado: { variant: 'destructive', icon: <XCircle className="w-3 h-3" /> },
    };
    const config = variants[status] || { variant: 'outline' as const, icon: null };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  const solicitacoesPendentes = solicitacoes.filter((s) => s.status === 'pendente');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Super Admin</h1>
          <p className="text-muted-foreground">Gestão de tenants e monitoramento global</p>
        </div>
        <Button onClick={() => { loadDashboard(); loadIgrejas(); loadSolicitacoes(); }} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Total Igrejas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.total_igrejas || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              Ativas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{dashboard?.igrejas_ativas || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-yellow-500" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{dashboard?.solicitacoes_pendentes || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Total Membros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.total_membros || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Eventos Mês
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard?.total_eventos_mes || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{solicitacoes.length}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="igrejas" className="w-full">
        <TabsList>
          <TabsTrigger value="igrejas" className="gap-2">
            <Building2 className="w-4 h-4" />
            Igrejas ({igrejas.length})
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-2">
            <Clock className="w-4 h-4" />
            Onboarding
            {solicitacoesPendentes.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {solicitacoesPendentes.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="metricas" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            Métricas
          </TabsTrigger>
        </TabsList>

        {/* Tab Igrejas */}
        <TabsContent value="igrejas" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Igrejas Cadastradas</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {igrejas.map((igreja) => (
                    <TableRow key={igreja.id}>
                      <TableCell className="font-medium">{igreja.nome}</TableCell>
                      <TableCell>
                        {igreja.cidade && igreja.estado
                          ? `${igreja.cidade}/${igreja.estado}`
                          : '-'}
                      </TableCell>
                      <TableCell>{igreja.email || '-'}</TableCell>
                      <TableCell>{getStatusBadge(igreja.status)}</TableCell>
                      <TableCell>
                        {format(new Date(igreja.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleViewMetricas(igreja)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        {igreja.status === 'ativo' && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleStatusChange(igreja.id, 'suspenso')}
                            disabled={processing}
                          >
                            Suspender
                          </Button>
                        )}
                        {igreja.status === 'suspenso' && (
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleStatusChange(igreja.id, 'ativo')}
                            disabled={processing}
                          >
                            Reativar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {igrejas.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        Nenhuma igreja cadastrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Onboarding */}
        <TabsContent value="onboarding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solicitações de Onboarding</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Igreja</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Cidade/UF</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {solicitacoes.map((sol) => (
                    <TableRow key={sol.id}>
                      <TableCell className="font-medium">{sol.nome_igreja}</TableCell>
                      <TableCell>{sol.nome_responsavel}</TableCell>
                      <TableCell>{sol.email}</TableCell>
                      <TableCell>
                        {sol.cidade && sol.estado ? `${sol.cidade}/${sol.estado}` : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(sol.status)}</TableCell>
                      <TableCell>
                        {format(new Date(sol.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right space-x-2">
                        {sol.status === 'pendente' && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleAprovar(sol.id)}
                              disabled={processing}
                            >
                              <CheckCircle2 className="w-4 h-4 mr-1" />
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setRejectDialog({ open: true, id: sol.id })}
                              disabled={processing}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              Rejeitar
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {solicitacoes.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        Nenhuma solicitação de onboarding
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Métricas */}
        <TabsContent value="metricas" className="space-y-4">
          {!selectedIgreja ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Selecione uma igreja na aba "Igrejas" para ver as métricas</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>{selectedIgreja.nome}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Métricas dos últimos 30 dias
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleRecalcularMetricas(selectedIgreja.id)}
                  disabled={processing}
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Recalcular
                </Button>
              </CardHeader>
              <CardContent>
                {loadingMetricas ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24" />
                    ))}
                  </div>
                ) : metricas.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma métrica disponível. Clique em "Recalcular" para gerar.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Última métrica como cards */}
                    {metricas[0] && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Users className="w-4 h-4" />
                            Membros
                          </div>
                          <div className="text-2xl font-bold">{metricas[0].total_membros}</div>
                          <div className="text-xs text-muted-foreground">
                            {metricas[0].membros_ativos} ativos
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Calendar className="w-4 h-4" />
                            Eventos
                          </div>
                          <div className="text-2xl font-bold">{metricas[0].total_eventos}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <TrendingUp className="w-4 h-4" />
                            Transações
                          </div>
                          <div className="text-2xl font-bold">{metricas[0].total_transacoes}</div>
                          <div className="text-xs text-muted-foreground">
                            R$ {metricas[0].valor_transacoes.toLocaleString('pt-BR')}
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <CheckCircle2 className="w-4 h-4" />
                            Check-ins
                          </div>
                          <div className="text-2xl font-bold">{metricas[0].total_checkins}</div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Database className="w-4 h-4" />
                            Armazenamento
                          </div>
                          <div className="text-2xl font-bold">
                            {(metricas[0].storage_bytes / (1024 * 1024)).toFixed(1)} MB
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {metricas[0].total_midias} mídias
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            <Activity className="w-4 h-4" />
                            API Calls
                          </div>
                          <div className="text-2xl font-bold">{metricas[0].total_chamadas_api}</div>
                          <div className="text-xs text-muted-foreground">
                            {metricas[0].total_erros_api} erros | {metricas[0].latencia_media_ms}ms avg
                          </div>
                        </div>
                        <div className="p-4 rounded-lg bg-muted/50">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                            🙏 Pedidos Oração
                          </div>
                          <div className="text-2xl font-bold">{metricas[0].total_pedidos_oracao}</div>
                        </div>
                      </div>
                    )}

                    {/* Histórico */}
                    <div>
                      <h4 className="font-medium mb-2">Histórico</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Data</TableHead>
                            <TableHead>Membros</TableHead>
                            <TableHead>Eventos</TableHead>
                            <TableHead>Transações</TableHead>
                            <TableHead>Check-ins</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {metricas.slice(0, 10).map((m) => (
                            <TableRow key={m.id}>
                              <TableCell>
                                {format(new Date(m.data_referencia), "dd/MM/yyyy", { locale: ptBR })}
                              </TableCell>
                              <TableCell>{m.total_membros}</TableCell>
                              <TableCell>{m.total_eventos}</TableCell>
                              <TableCell>{m.total_transacoes}</TableCell>
                              <TableCell>{m.total_checkins}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog de Rejeição */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, id: open ? rejectDialog.id : null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
            <DialogDescription>
              Informe o motivo da rejeição (opcional)
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Motivo da rejeição..."
            value={rejectMotivo}
            onChange={(e) => setRejectMotivo(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: null })}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRejeitar} disabled={processing}>
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
