/**
 * Agrupa transações pela coluna de data informada (default data_vencimento,
 * chave "" quando ausente), preservando a ordem de entrada dentro de cada
 * grupo. `coluna` deve acompanhar o mesmo eixo usado pra buscar as
 * transações (TipoDataFiltro) — senão o agrupamento/calendário mostra a
 * transação num dia diferente do que foi usado pra filtrar o período.
 */
export function agruparPorData<T extends object>(
  transacoes: T[] | undefined | null,
  coluna: "data_vencimento" | "data_pagamento" = "data_vencimento",
): Record<string, T[]> {
  if (!transacoes) return {};
  return transacoes.reduce((acc: Record<string, T[]>, t) => {
    const data =
      (t as Record<string, string | null | undefined>)[coluna] || "";
    if (!acc[data]) acc[data] = [];
    acc[data].push(t);
    return acc;
  }, {});
}

/** Datas dos grupos ordenadas por data — "desc" (mais recente primeiro,
 * default) ou "asc" (mais antiga primeiro). */
export function ordenarDatas(
  grupos: Record<string, unknown>,
  ordem: "asc" | "desc" = "desc",
): string[] {
  return Object.keys(grupos).sort((a, b) => {
    const diff = new Date(a).getTime() - new Date(b).getTime();
    return ordem === "asc" ? diff : -diff;
  });
}
