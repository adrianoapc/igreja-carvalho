/**
 * Paleta categórica compartilhada para séries de gráfico (recharts).
 *
 * Existiam 8+ paletas hex divergentes hardcoded em componentes de dashboard
 * (financas/Insights.tsx, financas/Dashboard.tsx, voluntario/Candidatos.tsx,
 * eventos/LiturgiaDashboard.tsx, admin/EdgeFunctionMonitoring.tsx), nenhuma
 * theme-aware — achado em auditoria de guardrails (2026-08-26). Os tokens
 * `--chart-1..5` já existem em `src/index.css` (claro E escuro definidos),
 * mas só `DashboardConciliacao.tsx` os usava. Este módulo centraliza o
 * acesso pra não repetir hex fixo em componente novo.
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

/** Cor de série por índice, ciclando se houver mais categorias que tokens. */
export function chartColor(index: number): string {
  return CHART_SERIES_COLORS[index % CHART_SERIES_COLORS.length];
}
