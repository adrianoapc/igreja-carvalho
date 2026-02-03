import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, AlertCircle, XCircle, ArrowRight, Undo2 } from "lucide-react";
import { useHideValues } from "@/hooks/useHideValues";

export interface MatchResult {
  extratoId: string;
  transacaoId: string;
  score: number;
  extratoDescricao: string;
  extratoValor: number;
  transacaoDescricao: string;
  transacaoValor: number;
  applied: boolean;
  error?: string;
}

interface ResultadoReconciliacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  results: MatchResult[];
  totalPendentes: number;
  onDesfazer?: () => void;
  isDesfazendo?: boolean;
}

export function ResultadoReconciliacaoDialog({
  open,
  onOpenChange,
  results,
  totalPendentes,
  onDesfazer,
  isDesfazendo,
}: ResultadoReconciliacaoDialogProps) {
  const { formatValue } = useHideValues();

  const successCount = results.filter((r) => r.applied).length;
  const failedCount = results.filter((r) => !r.applied).length;
  const pendentesRestantes = totalPendentes - successCount;

  const getScoreColor = (score: number) => {
    if (score >= 100) return "text-green-600 bg-green-100 dark:bg-green-900/30";
    if (score >= 80) return "text-blue-600 bg-blue-100 dark:bg-blue-900/30";
    if (score >= 70) return "text-amber-600 bg-amber-100 dark:bg-amber-900/30";
    return "text-orange-600 bg-orange-100 dark:bg-orange-900/30";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 100) return "Exato";
    if (score >= 80) return "Alto";
    if (score >= 70) return "Médio";
    return "Baixo";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Resultado da Reconciliação Automática
          </DialogTitle>
          <DialogDescription>
            Detalhes dos matches encontrados e aplicados
          </DialogDescription>
        </DialogHeader>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="text-xs font-medium text-green-700 dark:text-green-400">
                Conciliados
              </span>
            </div>
            <p className="text-2xl font-bold text-green-600">{successCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Pendentes
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-600">{pendentesRestantes}</p>
          </div>
          {failedCount > 0 && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-2 mb-1">
                <XCircle className="w-4 h-4 text-red-600" />
                <span className="text-xs font-medium text-red-700 dark:text-red-400">
                  Falhas
                </span>
              </div>
              <p className="text-2xl font-bold text-red-600">{failedCount}</p>
            </div>
          )}
        </div>

        {/* Matches List */}
        <div className="flex-1 min-h-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium">Matches Aplicados</h4>
            <span className="text-xs text-muted-foreground">
              Ordenados por score
            </span>
          </div>
          <ScrollArea className="h-[300px] pr-4">
            <div className="space-y-2">
              {results
                .filter((r) => r.applied)
                .sort((a, b) => b.score - a.score)
                .map((result, index) => (
                  <div
                    key={`${result.extratoId}-${index}`}
                    className="p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Extrato */}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs shrink-0">
                            Extrato
                          </Badge>
                          <span className="text-sm truncate">
                            {result.extratoDescricao}
                          </span>
                          <span className="text-sm font-medium shrink-0">
                            {formatValue(Math.abs(result.extratoValor))}
                          </span>
                        </div>
                        {/* Arrow */}
                        <div className="flex items-center gap-2 pl-2">
                          <ArrowRight className="w-3 h-3 text-muted-foreground" />
                        </div>
                        {/* Transação */}
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs shrink-0">
                            Transação
                          </Badge>
                          <span className="text-sm truncate">
                            {result.transacaoDescricao}
                          </span>
                          <span className="text-sm font-medium shrink-0">
                            {formatValue(Math.abs(result.transacaoValor))}
                          </span>
                        </div>
                      </div>
                      {/* Score */}
                      <div className="shrink-0">
                        <Badge className={getScoreColor(result.score)}>
                          {result.score}% {getScoreLabel(result.score)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              {results.filter((r) => r.applied).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Nenhum match encontrado ou aplicado</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {onDesfazer && successCount > 0 && (
            <Button
              variant="outline"
              onClick={onDesfazer}
              disabled={isDesfazendo}
              className="flex-1 sm:flex-initial"
            >
              <Undo2 className="w-4 h-4 mr-2" />
              {isDesfazendo ? "Desfazendo..." : "Desfazer Tudo"}
            </Button>
          )}
          <Button
            onClick={() => onOpenChange(false)}
            className="flex-1 sm:flex-initial"
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
