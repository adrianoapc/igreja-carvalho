import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { DreMonthGrid } from "./DreMonthGrid";
import { formatCurrencyDre, type SecaoAgrupada } from "../lib/dreCalculos";

interface SecaoDreCardProps {
  secao: SecaoAgrupada;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Card resumido de uma seção do DRE (mobile) — cabeçalho sempre visível com
 * o total do ano; toca pra expandir e ver o detalhe mensal + por categoria
 * (drill-down, mesmo dado da tabela desktop, só reorganizado em cards).
 */
export function SecaoDreCard({ secao, isExpanded, onToggle }: SecaoDreCardProps) {
  return (
    <Card className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-2 bg-primary/10 px-4 py-3 text-left transition-colors hover:bg-primary/15"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
        )}
        <span className="flex-1 truncate font-bold text-primary">
          {secao.secao || "Sem Classificação"}
        </span>
        <span
          className={cn(
            "shrink-0 font-bold tabular-nums",
            secao.totalAno < 0 && "text-destructive",
            secao.totalAno > 0 && "text-green-600",
          )}
        >
          {formatCurrencyDre(secao.totalAno)}
        </span>
      </button>

      {isExpanded && (
        <CardContent className="space-y-4 pt-4">
          <DreMonthGrid valores={secao.totaisMes} />

          {secao.categorias.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              {secao.categorias.map((cat) => (
                <div
                  key={cat.categoria_id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="truncate text-muted-foreground">
                    {cat.categoria_nome}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 font-medium tabular-nums",
                      cat.totalAno < 0 && "text-destructive",
                      cat.totalAno > 0 && "text-green-600",
                    )}
                  >
                    {formatCurrencyDre(cat.totalAno)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
