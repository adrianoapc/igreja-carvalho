import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, ListFilter } from "lucide-react";
import { PendenteExtratoCard } from "./PendenteExtratoCard";
import type { ExtratoItem, TransacaoConciliacao } from "../../model/types";
import type { SugestaoMatch } from "../../hooks/useDashboardConciliacaoData";

interface PendentesCardProps {
  extratosPendentes?: ExtratoItem[];
  transacoes?: TransacaoConciliacao[];
  sugestoes?: Map<string, SugestaoMatch>;
  onAceitarSugestao: (extrato: ExtratoItem, sugestao: SugestaoMatch) => void;
  onVincular: (extrato: ExtratoItem) => void;
  onDividir: (extrato: ExtratoItem) => void;
  onIgnorar: (extratoId: string) => void;
  className?: string;
}

/** Card "Pendentes de Conciliação" do dashboard — lista de extratos + sugestão. */
export function PendentesCard({
  extratosPendentes,
  transacoes,
  sugestoes,
  onAceitarSugestao,
  onVincular,
  onDividir,
  onIgnorar,
  className,
}: PendentesCardProps) {
  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ListFilter className="w-4 h-4" />
          Pendentes de Conciliação
          {extratosPendentes && extratosPendentes.length > 0 && (
            <Badge variant="secondary">{extratosPendentes.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {!extratosPendentes?.length ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="w-12 h-12 text-green-500 mb-3" />
              <p className="font-medium">Tudo conciliado!</p>
              <p className="text-sm text-muted-foreground">
                Não há extratos pendentes de conciliação
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {extratosPendentes.map((extrato) => {
                const sugestao = sugestoes?.get(extrato.id);
                const transacaoSugerida = sugestao
                  ? transacoes?.find((t) => t.id === sugestao.transacao_id)
                  : undefined;

                return (
                  <PendenteExtratoCard
                    key={extrato.id}
                    extrato={extrato}
                    sugestao={sugestao}
                    transacaoSugerida={transacaoSugerida}
                    onAceitarSugestao={onAceitarSugestao}
                    onVincular={onVincular}
                    onDividir={onDividir}
                    onIgnorar={onIgnorar}
                  />
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
