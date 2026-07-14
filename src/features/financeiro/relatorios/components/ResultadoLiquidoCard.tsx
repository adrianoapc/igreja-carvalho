import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { DreMonthGrid } from "./DreMonthGrid";
import { formatCurrencyDre } from "../lib/dreCalculos";

interface ResultadoLiquidoCardProps {
  resultadoLiquido: { [mes: number]: number };
  totalAno: number;
}

/**
 * Card do Resultado Líquido — sempre visível (não colapsável, ao contrário
 * das seções) e no topo da lista no mobile: é o número que o tesoureiro
 * quer ver primeiro, antes de entrar no detalhe por seção.
 */
export function ResultadoLiquidoCard({
  resultadoLiquido,
  totalAno,
}: ResultadoLiquidoCardProps) {
  return (
    <Card className="border-2 border-primary">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold">RESULTADO LÍQUIDO</span>
          <span
            className={cn(
              "text-lg font-bold tabular-nums",
              totalAno < 0 && "text-destructive",
              totalAno > 0 && "text-green-600",
            )}
          >
            {formatCurrencyDre(totalAno)}
          </span>
        </div>
        <DreMonthGrid valores={resultadoLiquido} />
      </CardContent>
    </Card>
  );
}
