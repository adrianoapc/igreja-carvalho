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

type ExtratoVinculo = { id: string; valor: number; data_transacao: string; descricao: string; filial_id: string | null };

export function useLotesAntecipacao() {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

  return useQuery({
    queryKey: ["getnet-antecipacao-lotes", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      // Fábrica em vez de builder reaproveitado: PostgrestFilterBuilder não
      // é seguro reexecutar após o primeiro await, cada página do loop
      // abaixo precisa da sua própria instância com os mesmos filtros.
      // NÃO embute extratos_bancarios(...) aqui — a RLS de SELECT dessa
      // tabela não é filial-scoped (§9.78), então o embed traria os dados
      // reais de um extrato de outra filial pro payload de rede antes de
      // qualquer filtro no cliente rodar (achado do /code-review, §9.79).
      // Os campos do extrato são resolvidos depois, via
      // fin_listar_extratos_vinculados_lote (SECURITY DEFINER, filtra por
      // has_filial_access ANTES de devolver linha nenhuma).
      const montarQuery = () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let q = (supabase.from as any)("getnet_antecipacao_lotes")
          .select(
            "id, filial_id, contrato_registradora, instituicao_negociadora, data_contratacao_contrato, valor_atual_contrato, extrato_bancario_id, lancamento_desagio_id, status",
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
      const lotes: Omit<LoteAntecipacao, "extratos_bancarios">[] = [];
      let offset = 0;
      while (true) {
        const { data, error } = await montarQuery().range(offset, offset + PAGE_SIZE - 1);
        if (error) throw error;
        lotes.push(...((data ?? []) as Omit<LoteAntecipacao, "extratos_bancarios">[]));
        if (!data || data.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      // Resolve os extratos vinculados em lotes de 500 ids (mesmo teto de
      // paginação do PostgREST acima — a RPC devolve no máximo 1 linha por
      // id pedido, então um lote de 500 ids nunca estoura os 1000).
      const extratoIds = Array.from(
        new Set(lotes.map((l) => l.extrato_bancario_id).filter((id): id is string => !!id)),
      );
      const extratoMap = new Map<string, ExtratoVinculo>();
      for (let i = 0; i < extratoIds.length; i += PAGE_SIZE) {
        const chunk = extratoIds.slice(i, i + PAGE_SIZE);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase.rpc as any)("fin_listar_extratos_vinculados_lote", {
          p_extrato_ids: chunk,
        });
        if (error) throw error;
        (data as ExtratoVinculo[] | null)?.forEach((e) => extratoMap.set(e.id, e));
      }

      const lotesComExtrato: LoteAntecipacao[] = lotes.map((l) => ({
        ...l,
        extratos_bancarios: l.extrato_bancario_id
          ? ((extratoMap.get(l.extrato_bancario_id) ?? null) as LoteAntecipacao["extratos_bancarios"])
          : null,
      }));

      if (isAllFiliais || !filialId) return lotesComExtrato;

      // Lote global (filial_id NULL) já VINCULADO a um extrato cujo id não
      // veio no mapa acima: fin_listar_extratos_vinculados_lote já filtrou
      // por has_filial_access, então "vinculado mas ausente do mapa" só
      // acontece quando o vínculo é de uma filial que este usuário não
      // acessa — mesmo tratamento de antes (linha oculta), só que agora o
      // DADO do extrato nunca trafega pra quem não tem acesso (achado do
      // /code-review, §9.79), não só a ação fica indisponível.
      return lotesComExtrato.filter((l) => {
        if (l.extrato_bancario_id && !l.extratos_bancarios) return false;
        const filialEfetiva = l.filial_id ?? l.extratos_bancarios?.filial_id ?? null;
        return filialEfetiva === null || filialEfetiva === filialId;
      });
    },
    enabled: !!igrejaId,
  });
}

/** Deságio = valor_atual_contrato - valor do extrato vinculado. Null se ainda não vinculado. */
export function calcularDesagio(lote: LoteAntecipacao): number | null {
  if (!lote.extratos_bancarios) return null;
  return (lote.valor_atual_contrato ?? 0) - lote.extratos_bancarios.valor;
}
