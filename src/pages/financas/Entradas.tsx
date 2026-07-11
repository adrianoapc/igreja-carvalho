import { TransacoesPage } from "@/features/financeiro/lancamentos/TransacoesPage";

/** Casca de rota (F2/ADR-029 §7.3) — a página real é única e parametrizada. */
export default function Entradas() {
  return <TransacoesPage tipo="entrada" />;
}
