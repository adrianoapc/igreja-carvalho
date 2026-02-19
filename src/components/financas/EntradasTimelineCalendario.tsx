import { format, eachDayOfInterval, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import { useHideValues } from "@/hooks/useHideValues";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface EntradasTimelineCalendarioProps {
  dataInicio: string; // yyyy-MM-dd
  dataFim: string; // yyyy-MM-dd
  dadosPorDia: Record<string, Array<any>>; // yyyy-MM-dd: [transacoes]
}

export function EntradasTimelineCalendario({
  dataInicio,
  dataFim,
  dadosPorDia,
}: EntradasTimelineCalendarioProps) {
  const { formatValue } = useHideValues();
  const [diaSelecionado, setDiaSelecionado] = useState<{
    data: string;
    transacoes: any[];
  } | null>(null);

  // Gerar array de todos os dias no range
  const diasDoRange = eachDayOfInterval({
    start: parseISO(dataInicio),
    end: parseISO(dataFim),
  });

  return (
    <>
      <div className="w-full p-6">
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-2" style={{ minWidth: "min-content" }}>
            {diasDoRange.map((data) => {
              const dataKey = format(data, "yyyy-MM-dd");
              const transacoes = dadosPorDia[dataKey] || [];
              const total = transacoes.reduce(
                (sum, t) => sum + Number(t.valor),
                0
              );

              return (
                <button
                  key={dataKey}
                  onClick={() => setDiaSelecionado({ data: dataKey, transacoes })}
                  className="flex-shrink-0 w-24"
                >
                  <Card className="h-32 p-3 flex flex-col justify-between hover:shadow-md hover:border-primary/50 transition-all cursor-pointer">
                    <div>
                      <div className="text-sm font-bold mb-2">
                        {format(data, "dd")}
                      </div>
                      <div className="text-xs text-muted-foreground font-medium">
                        {format(data, "EEE", { locale: ptBR }).toUpperCase()}
                      </div>
                      {total > 0 && (
                        <div className="text-xs font-semibold text-green-600 mt-1">
                          {formatValue(total)}
                        </div>
                      )}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {transacoes.length > 0 ? (
                        <span>
                          {transacoes.length} transação
                          {transacoes.length !== 1 ? "s" : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">-</span>
                      )}
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal de Detalhes do Dia */}
      <Dialog
        open={!!diaSelecionado}
        onOpenChange={(open) => !open && setDiaSelecionado(null)}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes de{" "}
              {diaSelecionado
                ? format(new Date(diaSelecionado.data), "dd 'de' MMMM 'de' yyyy", {
                    locale: ptBR,
                  })
                : ""}
            </DialogTitle>
          </DialogHeader>

          {diaSelecionado && diaSelecionado.transacoes.length > 0 ? (
            <div className="space-y-2">
              {diaSelecionado.transacoes.map((t, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm border-b pb-2"
                >
                  <span className="text-foreground">{t.descricao}</span>
                  <span className="font-semibold text-green-600 ml-4">
                    {formatValue(Number(t.valor))}
                  </span>
                </div>
              ))}
              <div className="border-t pt-3 mt-3 flex items-center justify-between font-bold">
                <span>Total do Dia</span>
                <span className="text-lg text-green-600">
                  {formatValue(
                    diaSelecionado.transacoes.reduce(
                      (sum, t) => sum + Number(t.valor),
                      0
                    )
                  )}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">
              Nenhuma transação neste dia
            </p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
