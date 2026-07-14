import { useState } from "react";
import { toast } from "sonner";
import { confirmarConciliacao } from "@/features/financeiro/core/api/conciliacao.api";
import type { MatchResult } from "@/components/financas/ResultadoReconciliacaoDialog";

/** Candidato 1:1 do motor único (score 0..1, escala nativa da RPC). */
export interface AutoReconciliarCandidato {
  extrato_id: string;
  transacao_id: string;
  score: number;
}

interface ExecutarParams {
  /** Nº de extratos pendentes no momento do clique (exibido no dialog de resultado). */
  totalPendentesAtual: number;
  /** Busca os candidatos 1:1 — cada tela tem sua própria janela/lista de contas. */
  buscarCandidatos: () => Promise<AutoReconciliarCandidato[]>;
  obterExtrato: (id: string) => { descricao: string; valor: number } | undefined;
  obterTransacao: (id: string) => { descricao: string; valor: number } | undefined;
}

/**
 * Lógica de "Reconciliar Automático" compartilhada por ConciliacaoManual e
 * DashboardConciliacao (F7 sub-frente 2/5): busca candidatos 1:1 do motor
 * único (F4), deduplica (um extrato só concilia uma transação e vice-versa —
 * evita FIN_CONCILIADO ao aplicar duas vezes a mesma transação no lote),
 * aplica cada match via `fin_confirmar_conciliacao` (F3) e monta o resultado
 * para o `ResultadoReconciliacaoDialog`. As duas telas tinham essa lógica
 * praticamente duplicada linha a linha — só a forma de buscar candidatos
 * (janela de datas, lista de contas) difere, por isso fica a cargo do
 * chamador via `buscarCandidatos`.
 */
export function useAutoReconciliar() {
  const [loading, setLoading] = useState(false);
  const [resultadoOpen, setResultadoOpen] = useState(false);
  const [resultados, setResultados] = useState<MatchResult[]>([]);
  const [totalPendentes, setTotalPendentes] = useState(0);

  const executar = async ({
    totalPendentesAtual,
    buscarCandidatos,
    obterExtrato,
    obterTransacao,
  }: ExecutarParams): Promise<MatchResult[]> => {
    setLoading(true);
    setTotalPendentes(totalPendentesAtual);

    try {
      const allMatches = await buscarCandidatos();

      if (allMatches.length === 0) {
        toast.info("Nenhuma correspondência encontrada automaticamente");
        return [];
      }

      // Um extrato só concilia uma transação — e vice-versa (evita
      // FIN_CONCILIADO ao aplicar duas vezes a mesma transação no lote).
      const processedExtratos = new Set<string>();
      const processedTransacoes = new Set<string>();
      const uniqueMatches = allMatches
        .sort((a, b) => b.score - a.score)
        .filter((match) => {
          if (processedExtratos.has(match.extrato_id)) return false;
          if (processedTransacoes.has(match.transacao_id)) return false;
          processedExtratos.add(match.extrato_id);
          processedTransacoes.add(match.transacao_id);
          return true;
        });

      // Aplica cada match pela porta transacional fin_confirmar_conciliacao
      // (F3) — baixa pendente→pago, trata irmã de transferência e audita.
      const results: MatchResult[] = [];
      for (const match of uniqueMatches) {
        const scorePct = Math.round(match.score * 100);
        const extratoData = obterExtrato(match.extrato_id);
        const transacaoData = obterTransacao(match.transacao_id);
        try {
          await confirmarConciliacao({
            extrato_ids: [match.extrato_id],
            transacao_ids: [match.transacao_id],
            score: match.score,
          });
          results.push({
            extratoId: match.extrato_id,
            transacaoId: match.transacao_id,
            score: scorePct,
            extratoDescricao: extratoData?.descricao || "Extrato",
            extratoValor: extratoData?.valor || 0,
            transacaoDescricao: transacaoData?.descricao || "Transação",
            transacaoValor: transacaoData?.valor || 0,
            applied: true,
          });
        } catch (applyError) {
          results.push({
            extratoId: match.extrato_id,
            transacaoId: match.transacao_id,
            score: scorePct,
            extratoDescricao: extratoData?.descricao || "Extrato",
            extratoValor: extratoData?.valor || 0,
            transacaoDescricao: transacaoData?.descricao || "Transação",
            transacaoValor: transacaoData?.valor || 0,
            applied: false,
            error: (applyError as Error)?.message,
          });
        }
      }

      const successCount = results.filter((r) => r.applied).length;
      if (successCount === 0) {
        toast.info("Nenhuma correspondência pôde ser aplicada");
      } else {
        toast.success(`${successCount} extrato(s) reconciliado(s) automaticamente`);
      }

      setResultados(results);
      setResultadoOpen(true);
      return results;
    } catch (err) {
      console.error("Exceção na reconciliação:", err);
      toast.error("Erro na reconciliação automática");
      return [];
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    resultadoOpen,
    setResultadoOpen,
    resultados,
    totalPendentes,
    executar,
  };
}
