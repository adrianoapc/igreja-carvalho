/**
 * Agrupa transações pela data de vencimento (chave "" quando ausente),
 * preservando a ordem de entrada dentro de cada grupo.
 */
export function agruparPorData<T extends { data_vencimento?: string | null }>(
  transacoes: T[] | undefined | null,
): Record<string, T[]> {
  if (!transacoes) return {};
  return transacoes.reduce((acc: Record<string, T[]>, t) => {
    const data = t.data_vencimento || "";
    if (!acc[data]) acc[data] = [];
    acc[data].push(t);
    return acc;
  }, {});
}

/** Datas dos grupos em ordem decrescente (mais recente primeiro). */
export function ordenarDatasDesc(grupos: Record<string, unknown>): string[] {
  return Object.keys(grupos).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime(),
  );
}
