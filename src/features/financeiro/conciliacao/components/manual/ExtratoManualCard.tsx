import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Link2, Split, X } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { anonymizePixDescription } from "@/utils/anonymization";
import type { ExtratoItem } from "../../model/types";

interface ExtratoManualCardProps {
  extrato: ExtratoItem;
  onVincular: (extrato: ExtratoItem) => void;
  onDividir: (extrato: ExtratoItem) => void;
  onIgnorar: (extratoId: string) => void;
}

/** Card de um extrato pendente na aba "Por Extrato" do Modo Clássico. */
export function ExtratoManualCard({
  extrato,
  onVincular,
  onDividir,
  onIgnorar,
}: ExtratoManualCardProps) {
  const { formatValue } = useHideValues();
  const isCredito = extrato.tipo === "credito" || extrato.tipo === "CREDIT";

  return (
    <div
      className={`p-4 rounded-lg border ${
        isCredito
          ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
          : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-medium text-sm truncate">
              {anonymizePixDescription(extrato.descricao)}
            </p>
            <Badge variant="outline" className="text-xs shrink-0">
              {isCredito ? "Crédito" : "Débito"}
            </Badge>
            {extrato.possivel_duplicata_de && (
              <Badge
                variant="outline"
                className="gap-1 border-amber-400 text-amber-700 dark:text-amber-400 text-xs font-normal shrink-0"
                title="Outra linha de extrato com mesmo valor/conta e data próxima, de origem diferente — pode ser a mesma movimentação importada duas vezes."
              >
                <AlertTriangle className="w-3 h-3" />
                possível duplicata
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {format(parseISO(extrato.data_transacao), "dd/MM/yyyy", {
                locale: ptBR,
              })}
            </span>
            {extrato.contas && (
              <>
                <span>•</span>
                <span className="truncate">{extrato.contas.nome}</span>
              </>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-bold ${isCredito ? "text-green-600" : "text-red-600"}`}>
            {isCredito ? "+" : "-"}
            {formatValue(Math.abs(extrato.valor))}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-3 flex-wrap">
        <Button size="sm" variant="default" onClick={() => onVincular(extrato)}>
          <Link2 className="w-3 h-3 mr-1" />
          Vincular
        </Button>
        <Button size="sm" variant="outline" onClick={() => onDividir(extrato)}>
          <Split className="w-3 h-3 mr-1" />
          Dividir
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onIgnorar(extrato.id)}>
          <X className="w-3 h-3 mr-1" />
          Ignorar
        </Button>
      </div>
    </div>
  );
}
