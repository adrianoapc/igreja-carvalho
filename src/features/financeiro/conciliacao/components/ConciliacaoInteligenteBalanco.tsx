import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHideValues } from "@/hooks/useHideValues";

interface ConciliacaoInteligenteBalancoProps {
  totalExtratos: number;
  totalTransacoes: number;
  diferenca: number;
  hasSelecao: boolean;
  confirming: boolean;
  onConfirmar: () => void;
  /**
   * "sidebar" = coluna vertical fixa entre os dois painéis (desktop).
   * "footer" = barra compacta fixa no rodapé (mobile, mesmo padrão do
   * TransacaoDialog: ações sempre visíveis independente da aba ativa).
   */
  variant: "sidebar" | "footer";
}

/** Resumo Banco × Sistema × Diferença + botão Confirmar. */
export function ConciliacaoInteligenteBalanco({
  totalExtratos,
  totalTransacoes,
  diferenca,
  hasSelecao,
  confirming,
  onConfirmar,
  variant,
}: ConciliacaoInteligenteBalancoProps) {
  const { formatValue } = useHideValues();
  const diferencaZerada = Math.abs(diferenca) < 0.01;
  const disabled = Math.abs(diferenca) >= 0.01 || !hasSelecao || confirming;

  if (variant === "footer") {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center gap-3 border-t bg-background p-3 shadow-lg md:hidden">
        <div className="flex flex-1 items-center justify-between gap-2 text-xs">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground leading-tight">Banco</p>
            <p className="font-bold text-green-600">{formatValue(totalExtratos)}</p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground leading-tight">Diferença</p>
            <p
              className={cn(
                "font-bold",
                diferencaZerada && hasSelecao ? "text-green-600" : "text-red-600",
              )}
            >
              {diferencaZerada ? "R$ 0,00" : formatValue(diferenca)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground leading-tight">Sistema</p>
            <p className="font-bold text-blue-600">{formatValue(totalTransacoes)}</p>
          </div>
        </div>
        <Button size="sm" disabled={disabled} onClick={onConfirmar} className="shrink-0">
          {confirming ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Confirmar"
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-32 flex flex-col items-center justify-center gap-2 p-3 bg-card rounded-lg border">
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">
          Banco
        </p>
        <p className="font-bold text-xs text-green-600">
          {formatValue(totalExtratos)}
        </p>
      </div>
      <div className="w-full h-px bg-border"></div>
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">
          Diferença
        </p>
        <p
          className={cn(
            "font-bold text-sm",
            diferencaZerada && hasSelecao ? "text-green-600" : "text-red-600",
          )}
        >
          {diferencaZerada ? "R$ 0,00" : formatValue(diferenca)}
        </p>
      </div>
      <div className="w-full h-px bg-border"></div>
      <div className="text-center">
        <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">
          Sistema
        </p>
        <p className="font-bold text-xs text-blue-600">
          {formatValue(totalTransacoes)}
        </p>
      </div>
      <Button
        className="w-full mt-2"
        size="sm"
        disabled={disabled}
        onClick={onConfirmar}
      >
        {confirming ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            <span className="text-xs">Aguarde...</span>
          </>
        ) : (
          <span className="text-xs">Confirmar</span>
        )}
      </Button>
    </div>
  );
}
