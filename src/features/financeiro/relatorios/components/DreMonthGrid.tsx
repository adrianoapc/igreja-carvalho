import { cn } from "@/lib/utils";
import { MESES, formatCurrencyDre } from "../lib/dreCalculos";

interface DreMonthGridProps {
  valores: { [mes: number]: number };
}

/**
 * Grade compacta dos 12 meses (3 colunas × 4 linhas) — usada dentro dos
 * cards do DRE mobile para mostrar o detalhe mensal sem recorrer a scroll
 * horizontal (o problema original: a tabela só tinha `overflow-x-auto`).
 */
export function DreMonthGrid({ valores }: DreMonthGridProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MESES.map((mes, idx) => {
        const valor = valores[idx + 1] || 0;
        return (
          <div key={mes} className="rounded-md bg-muted/40 px-2 py-1.5 text-center">
            <p className="text-[10px] text-muted-foreground leading-tight">{mes}</p>
            <p
              className={cn(
                "text-xs font-semibold tabular-nums leading-tight",
                valor === 0 && "text-muted-foreground/40",
                valor < 0 && "text-destructive",
                valor > 0 && "text-green-600",
              )}
            >
              {formatCurrencyDre(valor)}
            </p>
          </div>
        );
      })}
    </div>
  );
}
