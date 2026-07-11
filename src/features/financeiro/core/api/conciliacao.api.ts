import { supabase } from "@/integrations/supabase/client";
import { callFinRpc, type FinResultado } from "./finRpc";

/**
 * Wrappers das RPCs de conciliação transacional (ADR-030 / F3+F4).
 * Substituem a confirmação multi-tabela não transacional do frontend por
 * uma única transação no banco, cobrindo os três formatos de vínculo, e a
 * geração de candidatos pelo motor único de score (F4).
 */

/** Candidato retornado pelo motor único fin_gerar_candidatos_conciliacao. */
export interface CandidatoConciliacao {
  extrato_id: string;
  transacao_ids: string[];
  tipo_match: "1:1" | "1:N";
  score: number;
  features: Record<string, unknown>;
}

export interface CandidatosParams {
  /** Restringe a uma conta bancária (opcional). */
  contaId?: string | null;
  periodoInicio?: string | null;
  periodoFim?: string | null;
  /** Corte de score 0..1; default resolvido no banco (config por igreja → 0.6). */
  scoreMinimo?: number | null;
  /**
   * Filial selecionada na UI. `null`/omitido = "Todas" (cai no teto do usuário
   * no banco). Refina DENTRO do escopo permitido; validado por has_filial_access.
   */
  filialId?: string | null;
}

/**
 * Motor ÚNICO de candidatos de conciliação (ADR-030 F4). Substitui a RPC
 * legada `reconciliar_transacoes` e o score heurístico client-side. Retorna
 * candidatos 1:1 e 1:N já ranqueados por score (0..1). Tenant/ator e corte por
 * igreja são resolvidos no banco (fin_resolver_contexto + financeiro_config).
 */
export async function gerarCandidatosConciliacao(
  params: CandidatosParams = {},
): Promise<CandidatoConciliacao[]> {
  // fin_* ainda não está nos tipos gerados; cast único, como em finRpc.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(
    "fin_gerar_candidatos_conciliacao",
    {
      p_conta_id: params.contaId ?? null,
      p_periodo_inicio: params.periodoInicio ?? null,
      p_periodo_fim: params.periodoFim ?? null,
      p_score_minimo: params.scoreMinimo ?? null,
      p_filial_id: params.filialId ?? null,
    },
  );
  if (error) throw error;
  return (data ?? []) as CandidatoConciliacao[];
}

export interface DivisaoItem {
  transacao_id: string;
  valor: number;
}

export interface VinculoConciliacao {
  extrato_ids: string[];
  transacao_ids: string[];
  /** Obrigatório no formato 1:N (1 extrato → N transações). */
  divisoes?: DivisaoItem[];
  sugestao_id?: string;
  score?: number;
}

/**
 * Confirma a conciliação numa transação atômica. O formato (1:1, N:1, 1:N)
 * é inferido pela cardinalidade de extrato_ids × transacao_ids:
 * - 1 extrato + 1 transação → 1:1
 * - N extratos + 1 transação → N:1 (lote)
 * - 1 extrato + N transações → 1:N (divisão; exige `divisoes`)
 */
export function confirmarConciliacao(
  vinculo: VinculoConciliacao,
): Promise<FinResultado> {
  return callFinRpc("fin_confirmar_conciliacao", { p_vinculo: vinculo });
}

/**
 * Desfaz a conciliação de uma transação, limpando os três mecanismos de
 * vínculo (1:1, lote, divisão). Não reverte pago→pendente (dinheiro que caiu
 * permanece pago; reconciliar de novo é no-op de saldo).
 */
export function desconciliar(transacaoId: string): Promise<FinResultado> {
  return callFinRpc("fin_desconciliar", { p_transacao_id: transacaoId });
}
