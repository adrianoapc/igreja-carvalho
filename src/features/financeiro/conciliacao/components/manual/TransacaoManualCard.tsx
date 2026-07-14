import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Layers, Link2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import type { TransacaoConciliacao } from "../../model/types";

interface TransacaoManualCardProps {
  transacao: TransacaoConciliacao;
  onConciliarLote: (transacao: TransacaoConciliacao) => void;
}

/** Card de uma transação pendente na aba "Por Transação" do Modo Clássico. */
export function TransacaoManualCard({
  transacao,
  onConciliarLote,
}: TransacaoManualCardProps) {
  const { formatValue } = useHideValues();
  const isEntrada = transacao.tipo === "entrada";

  return (
    <div
      className={`p-4 rounded-lg border ${
        isEntrada
          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-medium text-sm truncate">{transacao.descricao}</p>
            <Badge variant="outline" className="text-xs shrink-0">
              {isEntrada ? "Entrada" : "Saída"}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {transacao.data_pagamento && (
              <span>
                {format(parseISO(transacao.data_pagamento), "dd/MM/yyyy", {
                  locale: ptBR,
                })}
              </span>
            )}
            {transacao.categorias_financeiras && (
              <>
                <span>•</span>
                <Badge variant="secondary" className="text-xs">
                  {transacao.categorias_financeiras.nome}
                </Badge>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-bold ${isEntrada ? "text-green-600" : "text-red-600"}`}>
            {formatValue(Math.abs(Number(transacao.valor)))}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Button size="sm" variant="default" onClick={() => onConciliarLote(transacao)}>
          <Layers className="w-3 h-3 mr-1" />
          Conciliar em Lote
        </Button>
        <Button size="sm" variant="outline" onClick={() => onConciliarLote(transacao)}>
          <Link2 className="w-3 h-3 mr-1" />
          Vincular 1:1
        </Button>
      </div>
    </div>
  );
}
