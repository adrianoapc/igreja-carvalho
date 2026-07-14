import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  CheckCircle2,
  Link2,
  Split,
  Sparkles,
  X,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { anonymizePixDescription } from "@/utils/anonymization";
import type { ExtratoItem, TransacaoConciliacao } from "../../model/types";
import type { SugestaoMatch } from "../../hooks/useDashboardConciliacaoData";

interface PendenteExtratoCardProps {
  extrato: ExtratoItem;
  sugestao?: SugestaoMatch;
  transacaoSugerida?: TransacaoConciliacao;
  onAceitarSugestao: (extrato: ExtratoItem, sugestao: SugestaoMatch) => void;
  onVincular: (extrato: ExtratoItem) => void;
  onDividir: (extrato: ExtratoItem) => void;
  onIgnorar: (extratoId: string) => void;
}

/** Card de um extrato pendente na lista "Pendentes de Conciliação" do dashboard. */
export function PendenteExtratoCard({
  extrato,
  sugestao,
  transacaoSugerida,
  onAceitarSugestao,
  onVincular,
  onDividir,
  onIgnorar,
}: PendenteExtratoCardProps) {
  const { formatValue } = useHideValues();
  const isCredito = extrato.tipo === "credit" || extrato.tipo === "credito";

  return (
    <div className="p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div
          className={`p-2 rounded-lg ${
            isCredito ? "bg-green-100 dark:bg-green-900/30" : "bg-red-100 dark:bg-red-900/30"
          }`}
        >
          {isCredito ? (
            <ArrowDownCircle className="w-4 h-4 text-green-600" />
          ) : (
            <ArrowUpCircle className="w-4 h-4 text-red-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm truncate">
            {anonymizePixDescription(extrato.descricao)}
          </p>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="text-xs text-muted-foreground">
              {format(parseISO(extrato.data_transacao), "dd/MM/yyyy", { locale: ptBR })}
            </span>
            {extrato.contas?.nome && (
              <Badge variant="outline" className="text-xs">
                {extrato.contas.nome}
              </Badge>
            )}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-bold ${isCredito ? "text-green-600" : "text-red-600"}`}>
            {formatValue(Math.abs(extrato.valor))}
          </p>
        </div>
      </div>

      {sugestao && transacaoSugerida && (
        <div className="mt-3 p-2 rounded bg-primary/5 border border-primary/20">
          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Sparkles className="w-3 h-3 text-primary shrink-0" />
            <span className="text-primary font-medium shrink-0">
              Sugestão ({sugestao.score}%):
            </span>
            <span className="truncate flex-1 min-w-[80px]">
              {transacaoSugerida.descricao}
            </span>
            <span className="font-medium shrink-0">
              {formatValue(Number(transacaoSugerida.valor))}
            </span>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        {sugestao && (
          <Button
            size="sm"
            variant="default"
            onClick={() => onAceitarSugestao(extrato, sugestao)}
          >
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Aceitar
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onVincular(extrato)}>
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
