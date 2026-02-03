import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, subDays, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { VincularTransacaoDialog } from "./VincularTransacaoDialog";
import { ConciliacaoLoteDialog } from "./ConciliacaoLoteDialog";
import { DividirExtratoDialog } from "./DividirExtratoDialog";
import { ResultadoReconciliacaoDialog, MatchResult } from "./ResultadoReconciliacaoDialog";
import { anonymizePixDescription } from "@/utils/anonymization";
import {
  RefreshCw,
  FileCheck,
  Clock,
  Layers,
  Percent,
  CheckCircle2,
  Link2,
  Split,
  X,
  Loader2,
  ArrowDownCircle,
  ArrowUpCircle,
  Sparkles,
  History,
  ListFilter,
  BarChart3,
} from "lucide-react";

interface ExtratoItem {
  id: string;
  conta_id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  reconciliado: boolean;
  transacao_vinculada_id?: string | null;
  origem?: string | null;
  contas?: { nome: string } | null;
}

interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_pagamento: string;
  categorias_financeiras?: { nome: string } | null;
  conta_id?: string | null;
}

interface AuditLog {
  id: string;
  extrato_id: string | null;
  transacao_id: string | null;
  conciliacao_lote_id: string | null;
  tipo_reconciliacao: string | null;
  score: number | null;
  valor_extrato: number | null;
  valor_transacao: number | null;
  created_at: string;
  extratos_bancarios?: { descricao: string; valor: number } | null;
  transacoes_financeiras?: { descricao: string; valor: number } | null;
}

interface SugestaoMatch {
  extrato_id: string;
  transacao_id: string;
  score: number;
}

export function DashboardConciliacao() {
  const { formatValue } = useHideValues();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const queryClient = useQueryClient();

  // State
  const [selectedContaId, setSelectedContaId] = useState<string>("all");
  const [reconciliacaoLoading, setReconciliacaoLoading] = useState(false);
  const [resultadoDialogOpen, setResultadoDialogOpen] = useState(false);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [totalPendentesAtReconciliacao, setTotalPendentesAtReconciliacao] = useState(0);
  
  // Dialog states
  const [selectedExtrato, setSelectedExtrato] = useState<ExtratoItem | null>(null);
  const [vincularDialogOpen, setVincularDialogOpen] = useState(false);
  const [dividirDialogOpen, setDividirDialogOpen] = useState(false);
  const [selectedTransacao, setSelectedTransacao] = useState<Transacao | null>(null);
  const [loteDialogOpen, setLoteDialogOpen] = useState(false);

  // Fetch accounts
  const { data: contas } = useQuery({
    queryKey: ["contas-dashboard", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch statistics
  const { data: stats, refetch: refetchStats } = useQuery({
    queryKey: ["reconciliacao-stats", igrejaId, filialId, isAllFiliais, selectedContaId],
    queryFn: async () => {
      if (!igrejaId) return { total: 0, reconciliados: 0, pendentes: 0, lotes: 0, cobertura: 0 };

      let extratoQuery = supabase
        .from("extratos_bancarios")
        .select("id, reconciliado", { count: "exact" })
        .eq("igreja_id", igrejaId);

      if (!isAllFiliais && filialId) {
        extratoQuery = extratoQuery.eq("filial_id", filialId);
      }
      if (selectedContaId !== "all") {
        extratoQuery = extratoQuery.eq("conta_id", selectedContaId);
      }

      const { data: extratos, count: totalExtratos } = await extratoQuery;

      const reconciliados = extratos?.filter((e) => e.reconciliado).length || 0;
      const pendentes = (totalExtratos || 0) - reconciliados;
      const cobertura = totalExtratos ? Math.round((reconciliados / totalExtratos) * 100) : 0;

      // Count batch conciliations
      let loteQuery = supabase
        .from("conciliacoes_lote")
        .select("id", { count: "exact" })
        .eq("igreja_id", igrejaId)
        .eq("status", "conciliada");

      if (!isAllFiliais && filialId) {
        loteQuery = loteQuery.eq("filial_id", filialId);
      }

      const { count: lotes } = await loteQuery;

      return {
        total: totalExtratos || 0,
        reconciliados,
        pendentes,
        lotes: lotes || 0,
        cobertura,
      };
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch pending statements
  const { data: extratosPendentes, refetch: refetchExtratos } = useQuery({
    queryKey: ["extratos-pendentes-dashboard", igrejaId, filialId, isAllFiliais, selectedContaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("extratos_bancarios")
        .select("*, contas(nome)")
        .eq("igreja_id", igrejaId)
        .eq("reconciliado", false)
        .is("transacao_vinculada_id", null)
        .order("data_transacao", { ascending: false })
        .limit(50);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      if (selectedContaId !== "all") {
        query = query.eq("conta_id", selectedContaId);
      }
      const { data, error } = await query;
      if (error) throw error;

      // Filter out CONTAMAX
      return (data as ExtratoItem[]).filter(
        (e) => !e.descricao?.toUpperCase().includes("CONTAMAX")
      );
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch transactions for matching
  const { data: transacoes } = useQuery({
    queryKey: ["transacoes-dashboard", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      const dataInicio = format(subDays(new Date(), 90), "yyyy-MM-dd");
      let query = supabase
        .from("transacoes_financeiras")
        .select("id, descricao, valor, tipo, data_pagamento, conta_id, categorias_financeiras(nome)")
        .eq("igreja_id", igrejaId)
        .eq("status", "pago")
        .gte("data_pagamento", dataInicio)
        .order("data_pagamento", { ascending: false })
        .limit(500);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Transacao[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch recent audit logs
  const { data: recentActions } = useQuery({
    queryKey: ["audit-logs-recent", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("reconciliacao_audit_logs")
        .select(`
          id,
          extrato_id,
          transacao_id,
          conciliacao_lote_id,
          tipo_reconciliacao,
          score,
          valor_extrato,
          valor_transacao,
          created_at,
          extratos_bancarios(descricao, valor),
          transacoes_financeiras(descricao, valor)
        `)
        .eq("igreja_id", igrejaId)
        .order("created_at", { ascending: false })
        .limit(10);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch suggestions for each pending statement
  const { data: sugestoes } = useQuery({
    queryKey: ["sugestoes-match", igrejaId, selectedContaId, extratosPendentes?.length],
    queryFn: async () => {
      if (!igrejaId || !extratosPendentes?.length) return new Map<string, SugestaoMatch>();

      const contaIds = selectedContaId !== "all"
        ? [selectedContaId]
        : [...new Set(extratosPendentes.map((e) => e.conta_id))];

      const allSugestoes: SugestaoMatch[] = [];

      for (const contaId of contaIds) {
        const { data } = await supabase.rpc("reconciliar_transacoes", {
          p_conta_id: contaId,
        });
        if (data) {
          allSugestoes.push(...data);
        }
      }

      // Create map with best suggestion per extrato
      const sugestaoMap = new Map<string, SugestaoMatch>();
      allSugestoes
        .sort((a, b) => b.score - a.score)
        .forEach((s) => {
          if (!sugestaoMap.has(s.extrato_id)) {
            sugestaoMap.set(s.extrato_id, s);
          }
        });

      return sugestaoMap;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId && !!extratosPendentes?.length,
  });

  // Reconciliação automática
  const handleReconciliarAutomatico = async () => {
    if (!extratosPendentes || extratosPendentes.length === 0) {
      toast.info("Nenhum extrato pendente para reconciliar");
      return;
    }

    setReconciliacaoLoading(true);
    setTotalPendentesAtReconciliacao(extratosPendentes.length);
    const contaIds = [...new Set(extratosPendentes.map((e) => e.conta_id))];
    const allResults: MatchResult[] = [];

    try {
      const allMatches: SugestaoMatch[] = [];

      for (const contaId of contaIds) {
        const { data, error } = await supabase.rpc("reconciliar_transacoes", {
          p_conta_id: contaId,
        });
        if (error) continue;
        if (data) allMatches.push(...data);
      }

      if (allMatches.length === 0) {
        toast.info("Nenhuma correspondência encontrada automaticamente");
        setReconciliacaoLoading(false);
        return;
      }

      // Deduplicate
      const processedExtratos = new Set<string>();
      const uniqueMatches = allMatches
        .sort((a, b) => b.score - a.score)
        .filter((match) => {
          if (processedExtratos.has(match.extrato_id)) return false;
          processedExtratos.add(match.extrato_id);
          return true;
        });

      // Apply each match
      for (const match of uniqueMatches) {
        try {
          const { data: applied, error: applyError } = await supabase.rpc(
            "aplicar_conciliacao",
            {
              p_extrato_id: match.extrato_id,
              p_transacao_id: match.transacao_id,
            }
          );

          const extratoData = extratosPendentes.find((e) => e.id === match.extrato_id);
          const transacaoData = transacoes?.find((t) => t.id === match.transacao_id);

          allResults.push({
            extratoId: match.extrato_id,
            transacaoId: match.transacao_id,
            score: match.score,
            extratoDescricao: extratoData?.descricao || "Extrato",
            extratoValor: extratoData?.valor || 0,
            transacaoDescricao: transacaoData?.descricao || "Transação",
            transacaoValor: Number(transacaoData?.valor) || 0,
            applied: applied && !applyError,
            error: applyError?.message,
          });
        } catch (err) {
          console.error("Erro ao aplicar match:", err);
        }
      }

      const successCount = allResults.filter((r) => r.applied).length;

      if (successCount === 0) {
        toast.info("Nenhuma correspondência pôde ser aplicada");
      } else {
        toast.success(`${successCount} extrato(s) reconciliado(s) automaticamente`);
      }

      setMatchResults(allResults);
      setResultadoDialogOpen(true);

      refetchExtratos();
      refetchStats();
      queryClient.invalidateQueries({ queryKey: ["audit-logs-recent"] });
      queryClient.invalidateQueries({ queryKey: ["sugestoes-match"] });
    } catch (err) {
      console.error("Exceção na reconciliação:", err);
      toast.error("Erro na reconciliação automática");
    } finally {
      setReconciliacaoLoading(false);
    }
  };

  // Handle accept suggestion
  const handleAceitarSugestao = async (extrato: ExtratoItem, sugestao: SugestaoMatch) => {
    try {
      const { data: applied, error } = await supabase.rpc("aplicar_conciliacao", {
        p_extrato_id: sugestao.extrato_id,
        p_transacao_id: sugestao.transacao_id,
      });

      if (error) throw error;

      if (applied) {
        toast.success("Conciliação aplicada com sucesso");
        refetchExtratos();
        refetchStats();
        queryClient.invalidateQueries({ queryKey: ["audit-logs-recent"] });
        queryClient.invalidateQueries({ queryKey: ["sugestoes-match"] });
      }
    } catch (err) {
      console.error("Erro ao aceitar sugestão:", err);
      toast.error("Erro ao aplicar conciliação");
    }
  };

  const handleIgnorar = async (extratoId: string) => {
    try {
      const { error } = await supabase
        .from("extratos_bancarios")
        .update({ reconciliado: true })
        .eq("id", extratoId);

      if (error) throw error;

      toast.success("Extrato marcado como ignorado");
      refetchExtratos();
      refetchStats();
    } catch (err) {
      console.error("Erro ao ignorar:", err);
      toast.error("Erro ao ignorar extrato");
    }
  };

  const handleVincular = (extrato: ExtratoItem) => {
    setSelectedExtrato(extrato);
    setVincularDialogOpen(true);
  };

  const handleDividir = (extrato: ExtratoItem) => {
    setSelectedExtrato(extrato);
    setDividirDialogOpen(true);
  };

  const handleSuccess = () => {
    refetchExtratos();
    refetchStats();
    queryClient.invalidateQueries({ queryKey: ["audit-logs-recent"] });
    queryClient.invalidateQueries({ queryKey: ["sugestoes-match"] });
  };

  const getTipoIcon = (tipo: string | null, hasLote: boolean) => {
    if (hasLote) {
      return <Layers className="w-4 h-4 text-purple-600" />;
    }
    switch (tipo) {
      case "automatico":
        return <Sparkles className="w-4 h-4 text-green-600" />;
      case "manual":
        return <CheckCircle2 className="w-4 h-4 text-blue-600" />;
      default:
        return <FileCheck className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTipoLabel = (tipo: string | null, hasLote: boolean) => {
    if (hasLote) return "Lote";
    if (tipo === "automatico") return "Auto";
    if (tipo === "manual") return "Manual";
    return tipo || "Conciliado";
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.pendentes || 0}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                <FileCheck className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.reconciliados || 0}</p>
                <p className="text-xs text-muted-foreground">Conciliados</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                <Layers className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.lotes || 0}</p>
                <p className="text-xs text-muted-foreground">Em Lote</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                <Percent className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats?.cobertura || 0}%</p>
                <p className="text-xs text-muted-foreground">Cobertura</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={selectedContaId} onValueChange={setSelectedContaId}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {contas?.map((conta) => (
              <SelectItem key={conta.id} value={conta.id}>
                {conta.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleReconciliarAutomatico}
          disabled={reconciliacaoLoading}
          className="ml-auto"
        >
          {reconciliacaoLoading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          {reconciliacaoLoading ? "Reconciliando..." : "Reconciliar Automático"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Actions */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="w-4 h-4" />
              Ações Recentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {!recentActions?.length ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma ação recente
                </p>
              ) : (
                <div className="space-y-3">
                  {recentActions.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-lg border bg-muted/30 space-y-1"
                    >
                      <div className="flex items-center gap-2">
                        {getTipoIcon(log.tipo_reconciliacao, !!log.conciliacao_lote_id)}
                        <Badge variant="outline" className="text-xs">
                          {getTipoLabel(log.tipo_reconciliacao, !!log.conciliacao_lote_id)}
                          {log.score && ` ${log.score}%`}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {formatDistanceToNow(parseISO(log.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                      {log.extratos_bancarios && (
                        <p className="text-xs truncate">
                          <span className="text-muted-foreground">Extrato:</span>{" "}
                          {anonymizePixDescription(log.extratos_bancarios.descricao)}
                        </p>
                      )}
                      {log.transacoes_financeiras && (
                        <p className="text-xs truncate">
                          <span className="text-muted-foreground">Transação:</span>{" "}
                          {log.transacoes_financeiras.descricao}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Pending Items */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ListFilter className="w-4 h-4" />
              Pendentes de Conciliação
              {extratosPendentes && extratosPendentes.length > 0 && (
                <Badge variant="secondary">{extratosPendentes.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px] pr-4">
              {!extratosPendentes?.length ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
                  <p className="font-medium">Tudo conciliado!</p>
                  <p className="text-sm text-muted-foreground">
                    Não há extratos pendentes de conciliação
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {extratosPendentes.map((extrato) => {
                    const sugestao = sugestoes?.get(extrato.id);
                    const transacaoSugerida = sugestao
                      ? transacoes?.find((t) => t.id === sugestao.transacao_id)
                      : null;

                    return (
                      <div
                        key={extrato.id}
                        className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                      >
                        {/* Extrato Info */}
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              extrato.tipo === "credit" || extrato.tipo === "credito"
                                ? "bg-green-100 dark:bg-green-900/30"
                                : "bg-red-100 dark:bg-red-900/30"
                            }`}
                          >
                            {extrato.tipo === "credit" || extrato.tipo === "credito" ? (
                              <ArrowDownCircle className="w-4 h-4 text-green-600" />
                            ) : (
                              <ArrowUpCircle className="w-4 h-4 text-red-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">
                              {anonymizePixDescription(extrato.descricao)}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-muted-foreground">
                                {format(parseISO(extrato.data_transacao), "dd/MM/yyyy", {
                                  locale: ptBR,
                                })}
                              </span>
                              {extrato.contas?.nome && (
                                <Badge variant="outline" className="text-xs">
                                  {extrato.contas.nome}
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="text-right">
                            <p
                              className={`font-bold ${
                                extrato.tipo === "credit" || extrato.tipo === "credito"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {formatValue(Math.abs(extrato.valor))}
                            </p>
                          </div>
                        </div>

                        {/* Suggestion */}
                        {sugestao && transacaoSugerida && (
                          <div className="mt-3 p-2 rounded bg-primary/5 border border-primary/20">
                            <div className="flex items-center gap-2 text-xs">
                              <Sparkles className="w-3 h-3 text-primary" />
                              <span className="text-primary font-medium">
                                Sugestão ({sugestao.score}%):
                              </span>
                              <span className="truncate flex-1">
                                {transacaoSugerida.descricao}
                              </span>
                              <span className="font-medium">
                                {formatValue(Number(transacaoSugerida.valor))}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="mt-3 flex flex-wrap gap-2">
                          {sugestao && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleAceitarSugestao(extrato, sugestao)}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Aceitar
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleVincular(extrato)}
                          >
                            <Link2 className="w-3 h-3 mr-1" />
                            Vincular
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDividir(extrato)}
                          >
                            <Split className="w-3 h-3 mr-1" />
                            Dividir
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleIgnorar(extrato.id)}
                          >
                            <X className="w-3 h-3 mr-1" />
                            Ignorar
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      {selectedExtrato && (
        <VincularTransacaoDialog
          open={vincularDialogOpen}
          onOpenChange={setVincularDialogOpen}
          extrato={selectedExtrato}
          transacoesDisponiveis={transacoes || []}
          onVinculado={handleSuccess}
        />
      )}

      <DividirExtratoDialog
        open={dividirDialogOpen}
        onOpenChange={setDividirDialogOpen}
        extrato={selectedExtrato}
        onSuccess={handleSuccess}
      />

      <ConciliacaoLoteDialog
        open={loteDialogOpen}
        onOpenChange={setLoteDialogOpen}
        transacao={selectedTransacao}
        onConciliado={handleSuccess}
      />

      <ResultadoReconciliacaoDialog
        open={resultadoDialogOpen}
        onOpenChange={setResultadoDialogOpen}
        results={matchResults}
        totalPendentes={totalPendentesAtReconciliacao}
      />
    </div>
  );
}
