import { Badge } from "@/components/ui/badge";
import { encargosAtivos, type EncargoTotais } from "@/features/financeiro/core";

/**
 * Badges de composição bruto×líquido (ADR-027) — desconto, taxa, juros e
 * multa de um lançamento ou de um total agregado. Compartilhado por
 * LancamentoCard (Lista/Agrupada) e pelos calendários Entradas/Saídas.
 */

const ENCARGO_BADGE_CLASSES: Record<string, string> = {
  desconto:
    "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300",
  taxas_administrativas:
    "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
  juros:
    "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  multas:
    "bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300",
};

interface EncargoBadgesProps {
  totais: EncargoTotais;
  formatCurrency: (value: number) => string;
  /** Quando informado, mostra também um badge "Bruto" (nominal, antes dos
   * encargos) — usado no detalhe do dia do calendário, onde o valor
   * principal da linha não muda de bruto pra líquido. */
  bruto?: number;
  /** Quando informado, mostra também um badge "Líquido" (efetivamente
   * pago/recebido) — mesmo motivo do `bruto`. */
  liquido?: number;
  className?: string;
}

export function EncargoBadges({
  totais,
  formatCurrency,
  bruto,
  liquido,
  className = "",
}: EncargoBadgesProps) {
  const ativos = encargosAtivos(totais);
  if (ativos.length === 0 && bruto === undefined && liquido === undefined) {
    return null;
  }

  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      {bruto !== undefined && (
        <Badge variant="outline" className="text-[10px] md:text-xs">
          Bruto {formatCurrency(bruto)}
        </Badge>
      )}
      {ativos.map(({ chave, label, valor }) => (
        <Badge
          key={chave}
          className={`text-[10px] md:text-xs ${ENCARGO_BADGE_CLASSES[chave]}`}
        >
          {label} {formatCurrency(valor)}
        </Badge>
      ))}
      {liquido !== undefined && (
        <Badge variant="outline" className="text-[10px] md:text-xs font-semibold">
          Líquido {formatCurrency(liquido)}
        </Badge>
      )}
    </div>
  );
}
