import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuperAdmin, type Igreja, type TenantMetrica } from "@/hooks/useSuperAdmin";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3,
  RefreshCw,
  Users,
  Calendar,
  CheckSquare,
  Database,
  Activity,
  TrendingUp,
  Building2,
} from "lucide-react";

export default function SuperAdminMetricas() {
  const { toast } = useToast();
  const {
    isSuperAdmin,
    loading,
    igrejas,
    loadIgrejas,
    calcularMetricas,
    loadMetricasTenant,
  } = useSuperAdmin();

  const [selectedIgrejaId, setSelectedIgrejaId] = useState<string | null>(null);
  const [metricas, setMetricas] = useState<TenantMetrica[]>([]);
  const [loadingMetricas, setLoadingMetricas] = useState(false);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      loadIgrejas();
    }
  }, [isSuperAdmin, loadIgrejas]);

  useEffect(() => {
    if (selectedIgrejaId) {
      handleLoadMetricas(selectedIgrejaId);
    }
  }, [selectedIgrejaId]);

  const handleLoadMetricas = async (igrejaId: string) => {
    setLoadingMetricas(true);
    const data = await loadMetricasTenant(igrejaId);
    setMetricas(data);
    setLoadingMetricas(false);
  };

  const handleRecalcular = async () => {
    if (!selectedIgrejaId) return;
    
    setProcessing(true);
    const success = await calcularMetricas(selectedIgrejaId);
    if (success) {
      toast({ title: "Métricas recalculadas com sucesso" });
      await handleLoadMetricas(selectedIgrejaId);
    } else {
      toast({ title: "Erro ao recalcular métricas", variant: "destructive" });
    }
    setProcessing(false);
  };

  const selectedIgreja = igrejas.find((i) => i.id === selectedIgrejaId);
  const latestMetrica = metricas[0];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Métricas por Tenant</h1>
          <p className="text-muted-foreground">
            Visualize métricas de uso de cada igreja
          </p>
        </div>
      </div>

      {/* Seletor de Igreja */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Selecionar Igreja</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Select
              value={selectedIgrejaId || ""}
              onValueChange={setSelectedIgrejaId}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Selecione uma igreja" />
              </SelectTrigger>
              <SelectContent>
                {igrejas.map((igreja) => (
                  <SelectItem key={igreja.id} value={igreja.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {igreja.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedIgrejaId && (
              <Button
                onClick={handleRecalcular}
                disabled={processing}
                variant="outline"
                size="sm"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${processing ? "animate-spin" : ""}`} />
                Recalcular
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Métricas */}
      {!selectedIgrejaId ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Selecione uma igreja para ver as métricas</p>
          </CardContent>
        </Card>
      ) : loadingMetricas ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !latestMetrica ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>Nenhuma métrica disponível para esta igreja.</p>
            <p className="text-sm mt-2">Clique em "Recalcular" para gerar métricas.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Cards de métricas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Membros
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestMetrica.total_membros}</div>
                <p className="text-xs text-muted-foreground">
                  {latestMetrica.membros_ativos} ativos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Eventos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestMetrica.total_eventos}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Check-ins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestMetrica.total_checkins}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Storage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(latestMetrica.storage_bytes / 1024 / 1024).toFixed(1)} MB
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Mais métricas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Transações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestMetrica.total_transacoes}</div>
                <p className="text-xs text-muted-foreground">
                  R$ {latestMetrica.valor_transacoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="w-4 h-4" />
                  Chamadas API
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestMetrica.total_chamadas_api}</div>
                <p className="text-xs text-muted-foreground">
                  {latestMetrica.total_erros_api} erros
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Latência Média
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{latestMetrica.latencia_media_ms}ms</div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
