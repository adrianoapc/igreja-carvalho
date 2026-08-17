import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { startOfMonth, subMonths } from "date-fns";

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

export interface DashboardConciliacaoFiltros {
  /** Meses retroativos a partir do mês corrente (mesmo seletor do Dashboard). */
  periodoMeses: string;
  /** `"all"` = todas as contas; senão UUID da conta. */
  contaFiltro: string;
}

/**
 * Dados do DashboardConciliacao — reduzido a "só indicadores" (o card de
 * pendentes/ações e o Reconciliar Automático saíram daqui pro Modo
 * Inteligente/Modo Clássico, que já cobrem essa jornada). O que sobra é o
 * feed de Ações Recentes; as demais métricas (cobertura, evolução mensal,
 * por tipo, detalhamento por conta) vêm de `view_reconciliacao_cobertura` e
 * são buscadas direto em `DashboardConciliacao.tsx` (herdadas do antigo
 * `RelatorioCobertura`, absorvido nesta tela).
 *
 * Os filtros de período/conta do Dashboard passam pra cá — sem isso o feed
 * ficava inconsistente com cobertura/estatísticas (Codex P2 na PR #111).
 */
export function useDashboardConciliacaoData({
  periodoMeses,
  contaFiltro,
}: DashboardConciliacaoFiltros) {
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();

  const { data: recentActions } = useQuery<AuditLog[]>({
    queryKey: [
      "audit-logs-recent",
      igrejaId,
      filialId,
      isAllFiliais,
      periodoMeses,
      contaFiltro,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];

      const dataInicio = startOfMonth(subMonths(new Date(), parseInt(periodoMeses, 10)));

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
        .gte("created_at", dataInicio.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);

      if (!isAllFiliais && filialId) {
        // Guardrail A: eventos com filial_id NULL (ator em "Todas" /
        // recurso compartilhado) devem continuar visíveis — mesmo padrão
        // da query de estatísticas em DashboardConciliacao.tsx. `.eq()`
        // puro omitia esses logs.
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      }

      if (contaFiltro !== "all") {
        query = query.eq("conta_id", contaFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as AuditLog[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  return { recentActions };
}
