import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCcw } from "lucide-react";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { TransacaoListItem } from "./TransacaoListItem";
import type { TransacaoItemComScore } from "./TransacaoListItem";
import type { Conta } from "../hooks/useConciliacaoInteligente";

interface TransacaoPainelProps {
  transacoes: TransacaoItemComScore[];
  loading: boolean;
  selectedTransacoes: string[];
  /** Usado só para resolver o nome exibido no badge de conta de cada item. */
  contas?: Conta[];
  mesTransacoes: Date;
  onMesTransacoesChange: (date: Date) => void;
  transacoesCustomRange: { from: Date; to: Date } | null;
  onTransacoesCustomRangeChange: (
    range: { from: Date; to: Date } | null,
  ) => void;
  onSelect: (id: string) => void;
  onLimparSelecao: () => void;
  onAjustarValores: (item: TransacaoItemComScore) => void;
  onMarcarConferenciaManual: (id: string) => void;
  className?: string;
}

/**
 * Painel "Sistema" — transações pendentes de conciliação. Usado tanto na
 * coluna direita do layout desktop quanto no conteúdo da aba "Sistema" no
 * mobile (F7 sub-frente 2/5).
 */
export function TransacaoPainel({
  transacoes,
  loading,
  selectedTransacoes,
  contas,
  mesTransacoes,
  onMesTransacoesChange,
  transacoesCustomRange,
  onTransacoesCustomRangeChange,
  onSelect,
  onLimparSelecao,
  onAjustarValores,
  onMarcarConferenciaManual,
  className,
}: TransacaoPainelProps) {
  const contaNomeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const conta of contas ?? []) map.set(conta.id, conta.nome);
    return map;
  }, [contas]);

  return (
    <div
      className={
        className ??
        "flex-1 flex flex-col border rounded-lg overflow-hidden bg-card"
      }
    >
      <div className="flex-shrink-0 px-3 py-1.5 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="font-semibold text-sm">Sistema</h3>
          <div className="flex items-center gap-1">
            <MonthPicker
              selectedMonth={mesTransacoes}
              onMonthChange={onMesTransacoesChange}
              customRange={transacoesCustomRange}
              onCustomRangeChange={onTransacoesCustomRangeChange}
              className="text-xs"
            />
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onLimparSelecao}
              title="Limpar seleção"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground leading-none">
          Transações Pendentes
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              Carregando...
            </p>
          )}
          {transacoes.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              Nenhuma transação pendente
            </p>
          )}
          {transacoes.map((item) => (
            <TransacaoListItem
              key={item.id}
              item={item}
              selected={selectedTransacoes.includes(item.id)}
              contaNome={contaNomeById.get(item.conta_id)}
              onSelect={onSelect}
              onAjustarValores={onAjustarValores}
              onMarcarConferenciaManual={onMarcarConferenciaManual}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
