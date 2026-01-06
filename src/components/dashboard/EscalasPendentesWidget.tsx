import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Calendar,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  MessageCircle,
  ChevronRight,
  TrendingUp,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import { useAuthContext } from "@/contexts/AuthContextProvider";

interface EscalaCulto {
  id: string;
  confirmado: boolean;
  status_confirmacao: string | null;
  culto: {
    id: string;
    titulo: string;
    data_evento: string;
  };
  time: {
    id: string;
    nome: string;
    cor: string;
  };
  pessoa: {
    id: string;
    nome: string;
    telefone: string | null;
  };
}

interface TimeSummary {
  timeId: string;
  timeNome: string;
  timeCor: string;
  total: number;
  confirmados: number;
  pendentes: number;
  recusados: number;
  percentualPendente: number;
}

const COLORS = {
  confirmados: "#22c55e",
  pendentes: "#eab308",
  recusados: "#ef4444",
};

export default function EscalasPendentesWidget() {
  const navigate = useNavigate();
  const {
    igrejaId,
    filialId,
    isAllFiliais,
    loading: authLoading,
  } = useAuthContext();

  const { data: escalas = [], isLoading } = useQuery({
    queryKey: ["escalas-proximos-7-dias", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      const hoje = new Date();
      const proximos7Dias = addDays(hoje, 7);

      let query = supabase
        .from("escalas")
        .select(
          `
          id,
          confirmado,
          status_confirmacao,
          culto:eventos!escalas_evento_id_fkey (
            id,
            titulo,
            data_evento
          ),
          time:times!escalas_time_id_fkey (
            id,
            nome,
            cor
          ),
          pessoa:profiles!escalas_pessoa_id_fkey (
            id,
            nome,
            telefone
          )
        `
        )
        .gte("culto.data_evento", hoje.toISOString())
        .lte("culto.data_evento", proximos7Dias.toISOString())
        .order("culto(data_evento)", { ascending: true });

      query = query.eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return (data || []).filter((e) => e.culto !== null) as EscalaCulto[];
    },
    refetchInterval: 60000,
    enabled: !!igrejaId && !authLoading,
  });

  const stats = {
    total: escalas.length,
    confirmados: escalas.filter(
      (e) => e.confirmado || e.status_confirmacao === "aceito"
    ).length,
    pendentes: escalas.filter(
      (e) =>
        !e.confirmado &&
        (!e.status_confirmacao || e.status_confirmacao === "pendente")
    ).length,
    recusados: escalas.filter((e) => e.status_confirmacao === "recusado")
      .length,
  };

  const timesSummary: Map<string, TimeSummary> = new Map();
  escalas.forEach((escala) => {
    const timeId = escala.time.id;
    if (!timesSummary.has(timeId)) {
      timesSummary.set(timeId, {
        timeId,
        timeNome: escala.time.nome,
        timeCor: escala.time.cor,
        total: 0,
        confirmados: 0,
        pendentes: 0,
        recusados: 0,
        percentualPendente: 0,
      });
    }
    const summary = timesSummary.get(timeId)!;
    summary.total++;
    if (escala.confirmado || escala.status_confirmacao === "aceito") {
      summary.confirmados++;
    } else if (escala.status_confirmacao === "recusado") {
      summary.recusados++;
    } else {
      summary.pendentes++;
    }
  });
  const timesArray = Array.from(timesSummary.values())
    .map((t) => ({
      ...t,
      percentualPendente: t.total > 0 ? (t.pendentes / t.total) * 100 : 0,
    }))
    .sort((a, b) => b.percentualPendente - a.percentualPendente);
  const timesEmAlerta = timesArray.filter(
    (t) => t.percentualPendente > 30 && t.pendentes > 0
  );
  const chartData = [
    {
      name: "Confirmados",
      value: stats.confirmados,
      color: COLORS.confirmados,
    },
    { name: "Pendentes", value: stats.pendentes, color: COLORS.pendentes },
    { name: "Recusados", value: stats.recusados, color: COLORS.recusados },
  ].filter((d) => d.value > 0);

  const handleNotificarPendentes = async () => {
    const pendentes = escalas.filter(
      (e) =>
        !e.confirmado &&
        (!e.status_confirmacao || e.status_confirmacao === "pendente") &&
        e.pessoa.telefone
    );
    if (pendentes.length === 0) {
      toast.info("Não há voluntários pendentes com telefone cadastrado");
      return;
    }
    toast.success(`Preparando ${pendentes.length} notificações`, {
      description: "Os voluntários serão notificados via WhatsApp em breve.",
    });
    // TODO: Integrar com webhook/API de notificação
    console.log("Pendentes para notificar:", pendentes);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-40 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (escalas.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Escalas dos Próximos 7 Dias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 space-y-3">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground opacity-50" />
            <p className="text-sm text-muted-foreground">
              Nenhuma escala nos próximos 7 dias
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const percentualConfirmados =
    stats.total > 0 ? Math.round((stats.confirmados / stats.total) * 100) : 0;

  return (
    <Card className="shadow-soft">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Escalas dos Próximos 7 Dias
          </CardTitle>
          <Badge
            variant={percentualConfirmados >= 70 ? "default" : "destructive"}
            className="text-sm"
          >
            {percentualConfirmados}% confirmado
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Resumo Visual */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-5 h-5 mx-auto text-green-600 mb-1" />
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">
              {stats.confirmados}
            </p>
            <p className="text-xs text-green-600 dark:text-green-500">
              Confirmados
            </p>
          </div>

          <div className="text-center p-3 rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
            <Clock className="w-5 h-5 mx-auto text-yellow-600 mb-1" />
            <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
              {stats.pendentes}
            </p>
            <p className="text-xs text-yellow-600 dark:text-yellow-500">
              Pendentes
            </p>
          </div>

          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <XCircle className="w-5 h-5 mx-auto text-red-600 mb-1" />
            <p className="text-2xl font-bold text-red-700 dark:text-red-400">
              {stats.recusados}
            </p>
            <p className="text-xs text-red-600 dark:text-red-500">Recusados</p>
          </div>
        </div>

        {/* Gráfico de Pizza */}
        {chartData.length > 0 && (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  verticalAlign="bottom"
                  height={36}
                  formatter={(
                    value: string,
                    entry: { payload?: { value?: number } }
                  ) => (
                    <span className="text-xs">
                      {value}: {entry.payload?.value ?? 0}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Times em Alerta */}
        {timesEmAlerta.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Ministérios que precisam de atenção:</span>
            </div>
            <div className="space-y-2">
              {timesEmAlerta.map((time) => (
                <div
                  key={time.timeId}
                  className="flex items-center justify-between p-3 rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-2 h-8 rounded"
                      style={{ backgroundColor: time.timeCor }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {time.timeNome}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress
                          value={(time.confirmados / time.total) * 100}
                          className="h-1.5 flex-1"
                        />
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {time.confirmados}/{time.total}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className="bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-700"
                  >
                    {time.pendentes} pendentes
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Times OK */}
        {timesArray.filter(
          (t) => t.percentualPendente <= 30 || t.pendentes === 0
        ).length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <span>Ministérios confirmados:</span>
            </div>
            <div className="space-y-1">
              {timesArray
                .filter((t) => t.percentualPendente <= 30 || t.pendentes === 0)
                .slice(0, 3)
                .map((time) => (
                  <div
                    key={time.timeId}
                    className="flex items-center justify-between p-2 rounded-lg bg-green-50 dark:bg-green-950/20"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-6 rounded"
                        style={{ backgroundColor: time.timeCor }}
                      />
                      <span className="text-sm font-medium">
                        {time.timeNome}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                    >
                      {time.confirmados}/{time.total} ✓
                    </Badge>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Ações */}
        <div className="flex gap-2 pt-2 border-t">
          {stats.pendentes > 0 && (
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={handleNotificarPendentes}
            >
              <MessageCircle className="w-4 h-4" />
              Cobrar {stats.pendentes} Pendentes
            </Button>
          )}
          <Button
            variant="ghost"
            className="gap-2"
            onClick={() => navigate("/escalas")}
          >
            Ver Todas
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Status Geral */}
        <div className="pt-2 border-t">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Status geral para os próximos eventos</span>
            {percentualConfirmados >= 80 ? (
              <Badge
                variant="outline"
                className="gap-1 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400"
              >
                <TrendingUp className="w-3 h-3" />
                Excelente
              </Badge>
            ) : percentualConfirmados >= 60 ? (
              <Badge
                variant="outline"
                className="gap-1 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-400"
              >
                <AlertTriangle className="w-3 h-3" />
                Atenção
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="gap-1 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400"
              >
                <XCircle className="w-3 h-3" />
                Crítico
              </Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
