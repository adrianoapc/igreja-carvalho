import { Button } from "@/components/ui/button";
import { Settings, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { parseLocalDate } from "@/utils/dateUtils";
import { useHideValues } from "@/hooks/useHideValues";
import type { TransacaoItem } from "../hooks/useConciliacaoInteligente";

export interface TransacaoItemComScore extends TransacaoItem {
  isSuggestion: boolean;
  score: number;
}

interface TransacaoListItemProps {
  item: TransacaoItemComScore;
  selected: boolean;
  onSelect: (id: string) => void;
  onAjustarValores: (item: TransacaoItemComScore) => void;
  onMarcarConferenciaManual: (id: string) => void;
}

/** Uma linha da lista de transações pendentes (painel "Sistema"). */
export function TransacaoListItem({
  item,
  selected,
  onSelect,
  onAjustarValores,
  onMarcarConferenciaManual,
}: TransacaoListItemProps) {
  const { formatValue } = useHideValues();

  return (
    <div
      id={`transacao-${item.id}`}
      className={cn(
        "px-2 py-1.5 rounded border cursor-pointer transition-colors text-xs group",
        selected
          ? "bg-blue-100 dark:bg-blue-900 border-blue-400"
          : item.isSuggestion
            ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
            : "border-border hover:bg-slate-50 dark:hover:bg-slate-800",
      )}
    >
      <div onClick={() => onSelect(item.id)}>
        <div className="flex items-center justify-between gap-1">
          <p className="font-medium truncate">{item.descricao}</p>
          {item.status === "pendente" && (
            <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0 rounded whitespace-nowrap">
              pendente
            </span>
          )}
        </div>
        <div className="flex justify-between items-center">
          <p className="text-xs text-muted-foreground">
            {(() => {
              const data = parseLocalDate(
                item.status === "pendente"
                  ? item.data_vencimento!
                  : item.data_pagamento!,
              );
              return data ? format(data, "dd/MM", { locale: ptBR }) : "-";
            })()}
          </p>
          <p
            className={cn(
              "font-bold text-xs",
              selected
                ? "text-blue-700 dark:text-blue-300"
                : item.tipo === "entrada"
                  ? "text-green-600"
                  : "text-red-600",
            )}
          >
            {formatValue(item.valor_liquido ?? item.valor)}
          </p>
        </div>
      </div>
      <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5"
          onClick={(e) => {
            e.stopPropagation();
            onAjustarValores(item);
          }}
          title="Ajustar valores (taxas, juros, etc.)"
        >
          <Settings className="w-3 h-3" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5"
          onClick={(e) => {
            e.stopPropagation();
            onMarcarConferenciaManual(item.id);
          }}
          title="Marcar como conciliado manualmente"
        >
          <CheckCircle2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
