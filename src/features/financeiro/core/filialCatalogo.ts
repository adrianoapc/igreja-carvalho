/**
 * Filtro de filial compartilhada pra queries de catálogo financeiro
 * (categoria/subcategoria/base ministerial/centro de custo) — nunca `.eq()`
 * puro em filial (guardrail financeiro). Extraído do TransferenciaDialog
 * pra não duplicar a mesma regra silenciosamente numa 2ª rodada.
 *
 * Semântica: filial específica ativa → aceita o registro dessa filial OU
 * global; sem filial pra desambiguar (isAllFiliais OU filialId ausente) →
 * só global. A transferência em si (fin_criar_transferencia) manda
 * `filial_id: null` nesses dois casos, e a validação `fin_validar_fk_filial`
 * do backend rejeita qualquer catálogo de filial específica contra ela —
 * sem esse filtro aqui, a busca por nome podia trazer o registro de uma
 * filial arbitrária e a transferência falhava com erro genérico.
 *
 * Nota: `filtrarPorFilialCatalogo` (useDadosApoio.ts, TransacaoDialog) tem
 * lógica PARECIDA mas não idêntica pro caso "nem isAllFiliais nem filialId"
 * (lá cai sem filtro nenhum, não só global) — não fundido aqui de propósito,
 * mudar aquele helper é escopo de outra fase (afeta fin_criar_lancamento).
 */
export function filtrarCatalogoPorFilial<T>(
  query: T,
  filialId: string | null,
  isAllFiliais: boolean,
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = query as any;
  if (isAllFiliais || !filialId) return q.is("filial_id", null);
  return q.or(`filial_id.eq.${filialId},filial_id.is.null`);
}

/**
 * Resolve o primeiro registro de catálogo que casa com a query, preferindo
 * o da filial específica sobre o global quando os dois existem com nome
 * parecido. `.order()` garante escolha determinística (não depende de
 * ordem física da tabela) mesmo sem preferência de filial pra aplicar.
 */
export async function primeiroCatalogoPorFilial<T extends { id: string; filial_id: string | null }>(
  montarQuery: () => PromiseLike<{ data: T[] | null; error: unknown }> & {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    or: (arg: string) => any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    is: (col: string, val: null) => any;
  },
  filialId: string | null,
  isAllFiliais: boolean,
): Promise<T | null> {
  const query = filtrarCatalogoPorFilial(montarQuery(), filialId, isAllFiliais);
  const { data, error } = await query
    .order("filial_id", { ascending: false, nullsFirst: false })
    .order("id")
    .limit(5);
  if (error) throw error;
  const linhas = (data ?? []) as T[];
  if (linhas.length === 0) return null;
  if (!isAllFiliais && filialId) {
    return linhas.find((l) => l.filial_id === filialId) ?? linhas[0];
  }
  return linhas[0];
}
