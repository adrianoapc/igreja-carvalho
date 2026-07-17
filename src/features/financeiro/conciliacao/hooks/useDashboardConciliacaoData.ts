import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { toast } from "sonner";
import { format, parseISO, subDays, addDays } from "date-fns";
import { gerarCandidatosConciliacao } from "@/features/financeiro/core/api/conciliacao.api";
import { confirmarConciliacao } from "@/features/financeiro/core/api/conciliacao.api";
import { marcarExtratoIgnorado } from "@/features/financeiro/core/api/extratos.api";
import type { ExtratoItem, TransacaoConciliacao, ContaConciliacao } from "../model/types";
import type { AutoReconciliarCandidato } from "./useAutoReconciliar";

export interface AuditLog {
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

export interface SugestaoMatch {
  extrato_id: string;
  transacao_id: string;
  /** Escala 0-100 para exibição (o motor devolve 0..1). */
  score: number;
}

/**
 * Sugestões 1:1 pelo motor ÚNICO de score (F4), substituindo a RPC legada
 * `reconciliar_transacoes`. Converte o score 0..1 para 0-100 (exibição).
 */
async function fetchSugestoes1x1(
  contaIds: string[],
  periodoInicio: string,
  periodoFim: string,
  filialId: string | null,
): Promise<SugestaoMatch[]> {
  const out: SugestaoMatch[] = [];
  for (const contaId of contaIds) {
    try {
      const rows = await gerarCandidatosConciliacao({
        contaId,
        periodoInicio,
        periodoFim,
        filialId,
      });
      for (const r of rows) {
        if (r.tipo_match === "1:1" && r.transacao_ids.length === 1) {
          out.push({
            extrato_id: r.extrato_id,
            transacao_id: r.transacao_ids[0],
            score: Math.round(r.score * 100),
          });
        }
      }
    } catch (err) {
      console.error("Erro ao gerar candidatos:", err);
    }
  }
  return out;
}

/**
 * Janela de candidatos derivada dos extratos pendentes VISÍVEIS (a lista do
 * dashboard não tem corte de data). Sem isso, um extrato mais antigo que a
 * janela fixa nunca receberia sugestão nem seria auto-conciliado.
 */
function periodoDosExtratos(
  extratos: Array<{ data_transacao?: string | null }>,
): { inicio: string; fim: string } {
  const hoje = format(new Date(), "yyyy-MM-dd");
  const datas = extratos
    .map((e) => e.data_transacao)
    .filter((d): d is string => !!d)
    .sort();
  if (datas.length === 0) {
    return { inicio: format(subDays(new Date(), 90), "yyyy-MM-dd"), fim: hoje };
  }
  const maxData = datas[datas.length - 1];
  return { inicio: datas[0], fim: maxData > hoje ? maxData : hoje };
}

/**
 * Dados/mutações do DashboardConciliacao — F7 sub-frente 2/5. Mesmas query
 * keys do arquivo original preservadas ("contas-dashboard",
 * "reconciliacao-stats", "extratos-pendentes-dashboard",
 * "transacoes-dashboard", "audit-logs-recent", "sugestoes-match").
 */
export function useDashboardConciliacaoData() {
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const queryClient = useQueryClient();

  const [selectedContaId, setSelectedContaId] = useState<string>("all");

  const { data: contas } = useQuery<ContaConciliacao[]>({
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

  const { data: extratosPendentes, refetch: refetchExtratos } = useQuery<ExtratoItem[]>({
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

      return (data as ExtratoItem[]).filter(
        (e) => !e.descricao?.toUpperCase().includes("CONTAMAX"),
      );
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  const { data: transacoes } = useQuery<TransacaoConciliacao[]>({
    queryKey: [
      "transacoes-dashboard",
      igrejaId,
      filialId,
      isAllFiliais,
      extratosPendentes?.length,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      // Janela alinhada aos candidatos: período dos extratos pendentes visíveis,
      // com folga de ±31 dias (o motor casa transação até ±30 dias do extrato).
      // Inclui PENDENTES (por data_vencimento) — o motor F4 pontua pendentes e
      // fin_confirmar_conciliacao faz a baixa; sem isso, o rótulo do resultado e
      // a sugestão exibida ficariam sem os dados da transação.
      const janela = periodoDosExtratos(extratosPendentes ?? []);
      const inicio = format(subDays(parseISO(janela.inicio), 31), "yyyy-MM-dd");
      const fim = format(addDays(parseISO(janela.fim), 31), "yyyy-MM-dd");
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          "id, descricao, valor, tipo, data_pagamento, data_vencimento, status, conta_id, categorias_financeiras(nome)",
        )
        .eq("igreja_id", igrejaId)
        .or(
          `and(status.eq.pago,data_pagamento.gte.${inicio},data_pagamento.lte.${fim}),` +
            `and(status.eq.pendente,data_vencimento.gte.${inicio},data_vencimento.lte.${fim})`,
        )
        .order("data_pagamento", { ascending: false, nullsFirst: false })
        .limit(500);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as TransacaoConciliacao[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  const { data: recentActions } = useQuery<AuditLog[]>({
    queryKey: ["audit-logs-recent", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("reconciliacao_audit_logs")
        .select(
          `
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
        `,
        )
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

  const { data: sugestoes } = useQuery({
    queryKey: ["sugestoes-match", igrejaId, selectedContaId, extratosPendentes?.length],
    queryFn: async () => {
      if (!igrejaId || !extratosPendentes?.length) return new Map<string, SugestaoMatch>();

      const contaIds =
        selectedContaId !== "all"
          ? [selectedContaId]
          : [...new Set(extratosPendentes.map((e) => e.conta_id))];

      const { inicio: periodoInicio, fim: periodoFim } = periodoDosExtratos(extratosPendentes);
      const allSugestoes = await fetchSugestoes1x1(
        contaIds,
        periodoInicio,
        periodoFim,
        isAllFiliais ? null : filialId,
      );

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

  const invalidarTudo = () => {
    refetchExtratos();
    refetchStats();
    queryClient.invalidateQueries({ queryKey: ["audit-logs-recent"] });
    queryClient.invalidateQueries({ queryKey: ["sugestoes-match"] });
  };

  const handleAceitarSugestao = async (extrato: ExtratoItem, sugestao: SugestaoMatch) => {
    try {
      await confirmarConciliacao({
        extrato_ids: [sugestao.extrato_id],
        transacao_ids: [sugestao.transacao_id],
        score: sugestao.score / 100,
      });
      toast.success("Conciliação aplicada com sucesso");
      invalidarTudo();
    } catch (err) {
      console.error("Erro ao aceitar sugestão:", err);
      toast.error("Erro ao aplicar conciliação");
    }
  };

  const handleIgnorar = async (extratoId: string) => {
    try {
      await marcarExtratoIgnorado(extratoId, true);
      toast.success("Extrato marcado como ignorado");
      refetchExtratos();
      refetchStats();
    } catch (err) {
      console.error("Erro ao ignorar:", err);
      toast.error("Erro ao ignorar extrato");
    }
  };

  /** Candidatos 1:1 do motor único (0..1) para o "Reconciliar Automático". */
  const buscarCandidatosAutoReconciliar = async (): Promise<AutoReconciliarCandidato[]> => {
    if (!extratosPendentes || extratosPendentes.length === 0) return [];
    const contaIds = [...new Set(extratosPendentes.map((e) => e.conta_id))];
    const { inicio: periodoInicio, fim: periodoFim } = periodoDosExtratos(extratosPendentes);
    const sugestoes100 = await fetchSugestoes1x1(
      contaIds,
      periodoInicio,
      periodoFim,
      isAllFiliais ? null : filialId,
    );
    // fetchSugestoes1x1 devolve 0-100 (escala de exibição); o hook
    // compartilhado de auto-reconciliar espera 0..1 (escala nativa da RPC).
    return sugestoes100.map((s) => ({
      extrato_id: s.extrato_id,
      transacao_id: s.transacao_id,
      score: s.score / 100,
    }));
  };

  const obterExtrato = (id: string) => extratosPendentes?.find((e) => e.id === id);
  const obterTransacao = (id: string) => {
    const t = transacoes?.find((tx) => tx.id === id);
    return t ? { descricao: t.descricao, valor: Number(t.valor) } : undefined;
  };

  return {
    contas,
    selectedContaId,
    setSelectedContaId,
    stats,
    extratosPendentes,
    transacoes,
    recentActions,
    sugestoes,
    handleAceitarSugestao,
    handleIgnorar,
    invalidarTudo,
    buscarCandidatosAutoReconciliar,
    obterExtrato,
    obterTransacao,
  };
}
