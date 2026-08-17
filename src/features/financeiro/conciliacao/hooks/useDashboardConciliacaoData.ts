import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";

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

/**
 * Dados do DashboardConciliacao — reduzido a "só indicadores" (o card de
 * pendentes/ações e o Reconciliar Automático saíram daqui pro Modo
 * Inteligente/Modo Clássico, que já cobrem essa jornada). O que sobra é o
 * feed de Ações Recentes; as demais métricas (cobertura, evolução mensal,
 * por tipo, detalhamento por conta) vêm de `view_reconciliacao_cobertura` e
 * são buscadas direto em `DashboardConciliacao.tsx` (herdadas do antigo
 * `RelatorioCobertura`, absorvido nesta tela).
 */
export function useDashboardConciliacaoData() {
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();

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

  return { recentActions };
}
