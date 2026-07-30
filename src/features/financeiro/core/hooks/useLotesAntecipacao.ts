import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "@/hooks/useFilialId";

/**
 * Lista os lotes de antecipação Getnet (getnet_antecipacao_lotes, Fase B).
 * Tabela nova, ainda fora de `types.ts` (regenerar após deploy) — mesmo cast
 * usado em `finRpc.ts` pras RPCs fin_*.
 */
export interface LoteAntecipacao {
  id: string;
  filial_id: string | null;
  contrato_registradora: string;
  instituicao_negociadora: string | null;
  data_contratacao_contrato: string | null;
  valor_atual_contrato: number | null;
  extrato_bancario_id: string | null;
  lancamento_desagio_id: string | null;
  status: "pendente_vinculo" | "vinculado" | "lancamento_criado";
  extratos_bancarios: {
    valor: number;
    data_transacao: string;
    descricao: string;
  } | null;
}

export function useLotesAntecipacao() {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

  return useQuery({
    queryKey: ["getnet-antecipacao-lotes", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let query = (supabase.from as any)("getnet_antecipacao_lotes")
        .select(
          "id, filial_id, contrato_registradora, instituicao_negociadora, data_contratacao_contrato, valor_atual_contrato, extrato_bancario_id, lancamento_desagio_id, status, extratos_bancarios(valor, data_transacao, descricao)",
        )
        .eq("igreja_id", igrejaId)
        .order("data_contratacao_contrato", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LoteAntecipacao[];
    },
    enabled: !!igrejaId,
  });
}

/** Deságio = valor_atual_contrato - valor do extrato vinculado. Null se ainda não vinculado. */
export function calcularDesagio(lote: LoteAntecipacao): number | null {
  if (!lote.extratos_bancarios) return null;
  return (lote.valor_atual_contrato ?? 0) - lote.extratos_bancarios.valor;
}
