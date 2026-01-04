import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuperAdmin, type OnboardingRequest } from "@/hooks/useSuperAdmin";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Users,
  Calendar,
  FileText,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

export default function SuperAdminDashboardPage() {
  const { toast } = useToast();
  const {
    isSuperAdmin,
    loading,
    dashboard,
    solicitacoes,
    loadDashboard,
    loadSolicitacoes,
    aprovarSolicitacao,
    rejeitarSolicitacao,
  } = useSuperAdmin();

  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string | null }>({
    open: false,
    id: null,
  });
  const [rejectMotivo, setRejectMotivo] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      loadDashboard();
      loadSolicitacoes();
    }
  }, [isSuperAdmin, loadDashboard, loadSolicitacoes]);

  const handleAprovar = async (id: string) => {
    setProcessing(true);
    const result = await aprovarSolicitacao(id);
    if (result.success) {
      toast({ title: "Igreja criada com sucesso!", description: result.message });
    } else {
      toast({ title: "Erro ao aprovar", description: result.message, variant: "destructive" });
    }
    setProcessing(false);
  };

  const handleRejeitar = async () => {
    if (!rejectDialog.id) return;
    setProcessing(true);
    const success = await rejeitarSolicitacao(rejectDialog.id, rejectMotivo);
    if (success) {
      toast({ title: "Solicitação rejeitada" });
    } else {
      toast({ title: "Erro ao rejeitar", variant: "destructive" });
    }
    setRejectDialog({ open: false, id: null });
    setRejectMotivo("");
    setProcessing(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<
      string,
      { variant: "default" | "secondary" | "destructive" | "outline"; icon: React.ReactNode }
    > = {
      ativo: { variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
      pendente: { variant: "secondary", icon: <Clock className="w-3 h-3" /> },
      suspenso: { variant: "destructive", icon: <AlertCircle className="w-3 h-3" /> },
      inativo: { variant: "outline", icon: <XCircle className="w-3 h-3" /> },
      aprovado: { variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
      rejeitado: { variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
    };
    const config = variants[status] || { variant: "outline" as const, icon: null };
    return (
      <Badge variant={config.variant} className="gap-1">
        {config.icon}
        {status}
      </Badge>
    );
  };

  const solicitacoesPendentes = solicitacoes.filter((s) => s.status === "pendente");

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral da plataforma SaaS</p>
        </div>
        <Button
          onClick={() => {
            loadDashboard();
            loadSolicitacoes();
          }}
          variant="outline"
          size="sm"
        >
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
            <div className="text-2xl font-bold text-green-600">
              {dashboard?.igrejas_ativas || 0}
            </div>
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
            <div className="text-2xl font-bold text-yellow-600">
              {dashboard?.solicitacoes_pendentes || 0}
            </div>
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

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span>Solicitações Pendentes</span>
              {solicitacoesPendentes.length > 0 && (
                <Badge variant="destructive">{solicitacoesPendentes.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {solicitacoesPendentes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma solicitação pendente
              </p>
            ) : (
              <div className="space-y-2">
                {solicitacoesPendentes.slice(0, 3).map((sol) => (
                  <div
                    key={sol.id}
                    className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                  >
                    <div>
                      <p className="font-medium text-sm">{sol.nome_igreja}</p>
                      <p className="text-xs text-muted-foreground">{sol.nome_responsavel}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleAprovar(sol.id)}
                        disabled={processing}
                      >
                        Aprovar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setRejectDialog({ open: true, id: sol.id })}
                        disabled={processing}
                      >
                        Rejeitar
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesso Rápido</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link to="/superadmin/igrejas">
                <span className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Gerenciar Igrejas
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-between" asChild>
              <Link to="/superadmin/metricas">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Ver Métricas
                </span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Dialog Rejeitar */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog({ open, id: null })}>
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
