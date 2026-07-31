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
    filial_id: string | null;
  } | null;
}

export function useLotesAntecipacao() {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

  return useQuery({
    queryKey: ["getnet-antecipacao-lotes", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      // Fábrica em vez de builder reaproveitado: PostgrestFilterBuilder não
      // é seguro reexecutar após o primeiro await, cada página do loop
      // abaixo precisa da sua própria instância com os mesmos filtros.
      const montarQuery = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase.from as any)("getnet_antecipacao_lotes")
          .select(
            "id, filial_id, contrato_registradora, instituicao_negociadora, data_contratacao_contrato, valor_atual_contrato, extrato_bancario_id, lancamento_desagio_id, status, extratos_bancarios(valor, data_transacao, descricao, filial_id)",
          )
          .eq("igreja_id", igrejaId)
          .order("data_contratacao_contrato", { ascending: false })
          .order("id", { ascending: false });
        if (!isAllFiliais && filialId) {
          // Lotes globais (filial_id NULL) são aceitos pelo backend em
          // qualquer filial (fin_vincular_lote_antecipacao) — eq() sozinho os
          // excluiria da visão de uma filial específica.
          q = q.or(`filial_id.eq.${filialId},filial_id.is.null`);
        }
        return q;
      };

      // PostgREST corta resposta sem paginação (teto de 1000 linhas) —
      // igrejas com muitos lotes importados perderiam os mais antigos da
      // lista em silêncio (achado do /code-review). Pagina com .range() até
      // uma página vir mais curta que PAGE_SIZE; .order("id") desempata
      // data_contratacao_contrato igual (ou NULL) entre páginas.
      const PAGE_SIZE = 500;
      const lotes: LoteAntecipacao[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await montarQuery().range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        lotes.push(...((data ?? []) as LoteAntecipacao[]));
        if (!data || data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }
      return lotes;
    },
    enabled: !!igrejaId,
  });
}

/** Deságio = valor_atual_contrato - valor do extrato vinculado. Null se ainda não vinculado. */
export function calcularDesagio(lote: LoteAntecipacao): number | null {
  if (!lote.extratos_bancarios) return null;
  return (lote.valor_atual_contrato ?? 0) - lote.extratos_bancarios.valor;
}
