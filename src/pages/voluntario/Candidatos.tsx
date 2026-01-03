import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { motion } from "framer-motion";
import { MetricCard, InsightCard } from "@/components/voluntario/MetricsComponents";
import {
  Users,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  BarChart3,
  Calendar,
  UserCheck,
  Filter,
  Download,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

interface CandidatoStats {
  total: number;
  pendentes: number;
  em_analise: number;
  aprovados: number;
  rejeitados: number;
  por_ministerio: { ministerio: string; total: number }[];
  por_mes: { mes: string; total: number }[];
}

interface Candidato {
  id: string;
  nome_contato: string;
  ministerio: string;
  status: string;
  created_at: string;
  telefone_contato: string | null;
  email_contato: string | null;
  disponibilidade: string;
  experiencia: string;
}

const STATUS_CONFIG = {
  pendente: { label: "Pendente", color: "#f59e0b", icon: Clock },
  em_analise: { label: "Em Análise", color: "#3b82f6", icon: AlertCircle },
  aprovado: { label: "Aprovado", color: "#10b981", icon: CheckCircle },
  em_trilha: { label: "Em Trilha", color: "#8b5cf6", icon: UserCheck },
  rejeitado: { label: "Rejeitado", color: "#ef4444", icon: XCircle },
};

export default function Candidatos() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<CandidatoStats | null>(null);
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroMinisterio, setFiltroMinisterio] = useState<string>("todos");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDados();
  }, []);

  const fetchDados = async () => {
    setLoading(true);
    try {
      // Buscar todos os candidatos
      const { data: candidatosData, error } = await supabase
        .from("candidatos_voluntario")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setCandidatos(candidatosData || []);

      // Calcular estatísticas
      const total = candidatosData?.length || 0;
      const pendentes = candidatosData?.filter(c => c.status === "pendente").length || 0;
      const em_analise = candidatosData?.filter(c => c.status === "em_analise").length || 0;
      const aprovados = candidatosData?.filter(c => c.status === "aprovado").length || 0;
      const rejeitados = candidatosData?.filter(c => c.status === "rejeitado").length || 0;

      // Por ministério
      const ministeriosCount = candidatosData?.reduce((acc, c) => {
        acc[c.ministerio] = (acc[c.ministerio] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const por_ministerio = Object.entries(ministeriosCount || {}).map(([ministerio, total]) => ({
        ministerio,
        total,
      }));

      // Por mês (últimos 6 meses)
      const mesesData = candidatosData?.reduce((acc, c) => {
        const mes = new Date(c.created_at).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
        acc[mes] = (acc[mes] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const por_mes = Object.entries(mesesData || {})
        .slice(-6)
        .map(([mes, total]) => ({ mes, total }));

      setStats({
        total,
        pendentes,
        em_analise,
        aprovados,
        rejeitados,
        por_ministerio,
        por_mes,
      });
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMudarStatus = async (candidatoId: string, novoStatus: string) => {
    try {
      const { error } = await supabase
        .from("candidatos_voluntario")
        .update({ status: novoStatus })
        .eq("id", candidatoId);

      if (error) throw error;

      // Atualizar estado local
      setCandidatos(prev =>
        prev.map(c => (c.id === candidatoId ? { ...c, status: novoStatus } : c))
      );

      // Recalcular stats
      fetchDados();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
  };

  const candidatosFiltrados = candidatos.filter(c => {
    if (filtroStatus !== "todos" && c.status !== filtroStatus) return false;
    if (filtroMinisterio !== "todos" && c.ministerio !== filtroMinisterio) return false;
    return true;
  });

  const ministerios = Array.from(new Set(candidatos.map(c => c.ministerio)));

  const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#f97316"];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-2"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-primary" />
              Gestão de Candidatos
            </h1>
            <p className="text-muted-foreground mt-1">
              Dashboard e análise de voluntários
            </p>
          </div>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Exportar Dados
          </Button>
        </div>
      </motion.div>

      {/* Cards de Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard
          title="Total de Candidatos"
          value={stats?.total || 0}
          change={12}
          changeLabel="vs. mês anterior"
          icon={Users}
          color="bg-blue-500"
        />
        <MetricCard
          title="Pendentes"
          value={stats?.pendentes || 0}
          icon={Clock}
          color="bg-amber-500"
          description="Aguardando análise"
        />
        <MetricCard
          title="Em Análise"
          value={stats?.em_analise || 0}
          icon={AlertCircle}
          color="bg-blue-500"
          description="Sendo avaliados"
        />
        <MetricCard
          title="Aprovados"
          value={stats?.aprovados || 0}
          change={8}
          changeLabel="este mês"
          icon={CheckCircle}
          color="bg-green-500"
        />
        <MetricCard
          title="Rejeitados"
          value={stats?.rejeitados || 0}
          icon={XCircle}
          color="bg-red-500"
          description="Total histórico"
        />
      </div>

      {/* Insights e Alertas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <InsightCard
          tipo="alerta"
          titulo="Candidatos pendentes há mais de 7 dias"
          descricao="Existem candidatos aguardando análise há mais de uma semana."
          valor={`${stats?.pendentes || 0} candidatos`}
        />
        <InsightCard
          tipo="meta"
          titulo="Meta de aprovação mensal"
          descricao="Você está no caminho certo para atingir a meta deste mês."
          valor="75% concluído"
        />
        <InsightCard
          tipo="tempo"
          titulo="Tempo médio de análise"
          descricao="Média de tempo entre inscrição e primeira resposta."
          valor="3.5 dias"
        />
        <InsightCard
          tipo="conquista"
          titulo="Maior crescimento"
          descricao="O ministério Kids teve o maior crescimento em candidaturas."
          valor="+45% este mês"
        />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Barras - Por Mês */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Candidaturas por Mês
            </CardTitle>
            <CardDescription>Evolução nos últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stats?.por_mes || []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                <XAxis dataKey="mes" stroke="#888888" fontSize={12} />
                <YAxis stroke="#888888" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                  }}
                />
                <Bar dataKey="total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Gráfico de Pizza - Por Ministério */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Distribuição por Ministério
            </CardTitle>
            <CardDescription>Candidatos ativos por área</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={stats?.por_ministerio || []}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ ministerio, percent }) =>
                    `${ministerio}: ${(percent * 100).toFixed(0)}%`
                  }
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="total"
                >
                  {(stats?.por_ministerio || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Candidatos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Lista de Candidatos</CardTitle>
              <CardDescription>
                {candidatosFiltrados.length} de {candidatos.length} candidatos
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-3 py-2 rounded-md border bg-background text-sm"
              >
                <option value="todos">Todos os status</option>
                {Object.entries(STATUS_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              <select
                value={filtroMinisterio}
                onChange={(e) => setFiltroMinisterio(e.target.value)}
                className="px-3 py-2 rounded-md border bg-background text-sm"
              >
                <option value="todos">Todos os ministérios</option>
                {ministerios.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {candidatosFiltrados.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum candidato encontrado com os filtros aplicados.
              </p>
            ) : (
              candidatosFiltrados.map((candidato) => {
                const config = STATUS_CONFIG[candidato.status as keyof typeof STATUS_CONFIG];
                const Icon = config.icon;

                return (
                  <motion.div
                    key={candidato.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-4 rounded-lg border bg-card hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-3">
                          <h3 className="font-semibold">{candidato.nome_contato}</h3>
                          <Badge
                            variant="outline"
                            className="text-xs"
                            style={{ borderColor: config.color, color: config.color }}
                          >
                            <Icon className="w-3 h-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-muted-foreground">
                          <div>
                            <span className="font-medium">Ministério:</span> {candidato.ministerio}
                          </div>
                          <div>
                            <span className="font-medium">Disponibilidade:</span>{" "}
                            {candidato.disponibilidade}
                          </div>
                          <div>
                            <span className="font-medium">Experiência:</span> {candidato.experiencia}
                          </div>
                          <div>
                            <span className="font-medium">Data:</span>{" "}
                            {new Date(candidato.created_at).toLocaleDateString("pt-BR")}
                          </div>
                        </div>
                        {(candidato.telefone_contato || candidato.email_contato) && (
                          <div className="text-sm text-muted-foreground">
                            {candidato.telefone_contato && (
                              <span className="mr-4">📱 {candidato.telefone_contato}</span>
                            )}
                            {candidato.email_contato && <span>✉️ {candidato.email_contato}</span>}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {candidato.status === "pendente" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleMudarStatus(candidato.id, "em_analise")}
                            >
                              Analisar
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleMudarStatus(candidato.id, "aprovado")}
                            >
                              Aprovar
                            </Button>
                          </>
                        )}
                        {candidato.status === "em_analise" && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleMudarStatus(candidato.id, "aprovado")}
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleMudarStatus(candidato.id, "rejeitado")}
                            >
                              Rejeitar
                            </Button>
                          </>
                        )}
                        {candidato.status === "aprovado" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMudarStatus(candidato.id, "em_trilha")}
                          >
                            Iniciar Trilha
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
