/**
 * Paleta categórica compartilhada para séries de gráfico (recharts).
 *
 * Existem 8+ paletas hex divergentes hardcoded em componentes de dashboard
 * (financas/Insights.tsx, financas/Dashboard.tsx, voluntario/Candidatos.tsx,
 * eventos/LiturgiaDashboard.tsx, admin/EdgeFunctionMonitoring.tsx), nenhuma
 * theme-aware — achado em auditoria de guardrails (2026-08-26). Os tokens
 * `--chart-1..5` já existem em `src/index.css` (claro E escuro definidos),
 * mas só `DashboardConciliacao.tsx` os usava. Este módulo centraliza o
 * acesso pra não repetir hex fixo em componente novo.
 *
 * **Migração dos 5 arquivos acima ainda NÃO feita** (achado real de
 * `/code-review ultra` local, PR #134: este módulo nasceu sem nenhum
 * consumidor na mesma PR — o problema que o comentário acima descreve
 * segue idêntico em produção até alguém migrar cada arquivo, um a um,
 * COM verificação visual em dev server, já que são hex escolhidos a
 * dedo, não garantidamente equivalentes aos tokens `--chart-1..5`).
 * O aviso não-bloqueante em `pattern-guardrails.yml` (hex hardcoded em
 * arquivo tocado) é o único nudge automático pra migração orgânica —
 * não force os 5 arquivos de uma vez só numa PR que não é sobre
 * dataviz.
 *
 * Ver skill `dataviz` para heurísticas de forma de gráfico e regras de
 * paleta sequencial/divergente além da categórica coberta aqui. Para cor
 * de STATUS (pill/badge), usar `statusPalette.ts`
 * (`src/features/financeiro/core/lib/statusPalette.ts`), não este arquivo.
 */

export const CHART_SERIES_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
] as const;

/**
 * Cor de série por índice, ciclando se houver mais categorias que tokens.
 * Normaliza índice negativo/fracionário — achado real de `/code-review
 * ultra` local (PR #134): `%` em JS preserva o sinal do dividendo
 * (`-1 % 5 === -1`, não `4`), então `chartColor(-1)` sem normalização
 * devolveria `undefined` (índice negativo não dá wrap em array JS) —
 * um caller que deriva o índice de `findIndex` (retorna `-1` sem match)
 * receberia `undefined` como `fill`/`stroke` do recharts silenciosamente.
 */
export function chartColor(index: number): string {
  const n = CHART_SERIES_COLORS.length;
  const i = ((Math.trunc(index) % n) + n) % n;
  return CHART_SERIES_COLORS[i];
}
