import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RotateCcw } from "lucide-react";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { ExtratoListItem } from "./ExtratoListItem";
import type { ExtratoItem } from "../hooks/useConciliacaoInteligente";
import type { SugestaoExtrato } from "./ExtratoListItem";

interface ExtratoPainelProps {
  extratos: ExtratoItem[];
  totalExtratosBrutos: number;
  loading: boolean;
  selectedExtratos: string[];
  sugestoesMap: Record<string, SugestaoExtrato>;
  isRejectingSugestao: boolean;
  mesExtratos: Date;
  onMesExtratosChange: (date: Date) => void;
  extratosCustomRange: { from: Date; to: Date } | null;
  onExtratosCustomRangeChange: (range: { from: Date; to: Date } | null) => void;
  onSelect: (id: string) => void;
  onLimparSelecao: () => void;
  onAceitarSugestao: (extratoId: string, transacaoId?: string) => void;
  onRejeitarSugestao: (sugestaoId: string) => void;
  onOpenQuickCreate: (e: React.MouseEvent, item: ExtratoItem) => void;
  /** Altura do painel — a orquestração decide conforme desktop/mobile. */
  className?: string;
}

/**
 * Painel "Banco" — extratos pendentes de conciliação. Usado tanto na coluna
 * esquerda do layout desktop quanto no conteúdo da aba "Banco" no mobile
 * (F7 sub-frente 2/5 — mesmo componente, containers diferentes por viewport).
 */
export function ExtratoPainel({
  extratos,
  totalExtratosBrutos,
  loading,
  selectedExtratos,
  sugestoesMap,
  isRejectingSugestao,
  mesExtratos,
  onMesExtratosChange,
  extratosCustomRange,
  onExtratosCustomRangeChange,
  onSelect,
  onLimparSelecao,
  onAceitarSugestao,
  onRejeitarSugestao,
  onOpenQuickCreate,
  className,
}: ExtratoPainelProps) {
  return (
    <div
      className={
        className ??
        "flex-1 flex flex-col border rounded-lg overflow-hidden bg-card"
      }
    >
      <div className="flex-shrink-0 px-3 py-1.5 border-b bg-muted/30">
        <div className="flex items-center justify-between mb-0.5">
          <h3 className="font-semibold text-sm">Banco</h3>
          <div className="flex items-center gap-1">
            <MonthPicker
              selectedMonth={mesExtratos}
              onMonthChange={onMesExtratosChange}
              customRange={extratosCustomRange}
              onCustomRangeChange={onExtratosCustomRangeChange}
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
        <p className="text-xs text-muted-foreground">Extratos Pendentes</p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {loading && (
            <p className="text-xs text-muted-foreground px-2 py-1">
              Carregando...
            </p>
          )}
          {extratos.length === 0 && !loading && (
            <div className="text-xs text-muted-foreground px-2 py-1">
              <p>Nenhum extrato pendente</p>
              {totalExtratosBrutos > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  Total: {totalExtratosBrutos} (filtrado: {extratos.length})
                </p>
              )}
            </div>
          )}
          {extratos.map((item) => (
            <ExtratoListItem
              key={item.id}
              item={item}
              selected={selectedExtratos.includes(item.id)}
              sugestao={sugestoesMap[item.id]}
              isRejectingSugestao={isRejectingSugestao}
              onSelect={onSelect}
              onAceitarSugestao={onAceitarSugestao}
              onRejeitarSugestao={onRejeitarSugestao}
              onOpenQuickCreate={onOpenQuickCreate}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
