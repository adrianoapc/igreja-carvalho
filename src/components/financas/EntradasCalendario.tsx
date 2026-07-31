import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHideValues } from "@/hooks/useHideValues";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { somarEncargos, temEncargo } from "@/features/financeiro/core";
import { EncargoBadges } from "@/components/financas/EncargoBadges";

interface EntradasCalendarioProps {
  ano: number;
  mes: number; // 0-11
  dadosPorDia: Record<string, Array<any>>; // yyyy-MM-dd: [transacoes]
}

export function EntradasCalendario({ ano, mes, dadosPorDia }: EntradasCalendarioProps) {
  const { formatValue } = useHideValues();
  const [diaSelecionado, setDiaSelecionado] = useState<{ data: string; transacoes: any[] } | null>(null);

  // Gera matriz de dias do mês para exibir na grade
  const primeiroDia = new Date(ano, mes, 1);
  const ultimoDia = new Date(ano, mes + 1, 0);
  const diasNoMes = ultimoDia.getDate();
  const diaSemanaInicio = primeiroDia.getDay(); // 0=domingo

  // Monta matriz de semanas (cada semana é um array de dias)
  const semanas: Array<Array<number | null>> = [];
  let semana: Array<number | null> = Array(diaSemanaInicio).fill(null);
  for (let d = 1; d <= diasNoMes; d++) {
    semana.push(d);
    if (semana.length === 7) {
      semanas.push(semana);
      semana = [];
    }
  }
  if (semana.length > 0) {
    while (semana.length < 7) semana.push(null);
    semanas.push(semana);
  }

  return (
    <>
      <div className="w-full p-6">
        <div className="grid grid-cols-7 gap-2 mb-3">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((dia) => (
            <div key={dia} className="text-sm font-bold text-center py-2 text-muted-foreground">
              {dia}
            </div>
          ))}
        </div>
        
        {semanas.map((sem, i) => (
          <div key={i} className="grid grid-cols-7 gap-2 mb-2">
            {sem.map((dia, j) => {
              if (!dia) {
                return <div key={j} className="h-32 bg-muted/20 rounded-lg" />;
              }
              const dataKey = format(new Date(ano, mes, dia), "yyyy-MM-dd");
              const transacoes = dadosPorDia[dataKey] || [];
              const totalEntradas = transacoes.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + Number(t.valor), 0);
              const totalSaidas = transacoes.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + Number(t.valor), 0);
              const total = totalEntradas - totalSaidas;
              const totalEntradasLiquido = transacoes.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + Number(t.valor_liquido ?? t.valor), 0);
              const totalSaidasLiquido = transacoes.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + Number(t.valor_liquido ?? t.valor), 0);
              const totalLiquido = totalEntradasLiquido - totalSaidasLiquido;

              return (
                <button
                  key={j}
                  onClick={() => setDiaSelecionado({ data: dataKey, transacoes })}
                  className="h-32 cursor-pointer"
                >
                  <Card className="h-full p-3 flex flex-col justify-between hover:shadow-md hover:border-primary/50 transition-all">
                    <div>
                      <div className="text-lg font-bold mb-2">{dia}</div>
                      {(total !== 0 || totalLiquido !== 0) && (
                        <div>
                          <div className={`text-xs font-semibold ${total >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {total >= 0 ? '+' : ''}{formatValue(total)}
                          </div>
                          {totalLiquido !== total && (
                            <div className="text-[10px] text-muted-foreground">
                              Líq. {totalLiquido >= 0 ? '+' : ''}{formatValue(totalLiquido)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {transacoes.length > 0 ? (
                        <span>{transacoes.length} transação{transacoes.length !== 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-muted-foreground/50">Sem movimentação</span>
                      )}
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Modal de Detalhes do Dia */}
      <Dialog open={!!diaSelecionado} onOpenChange={(open) => !open && setDiaSelecionado(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Detalhes de {diaSelecionado ? format(new Date(diaSelecionado.data), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : ''}
            </DialogTitle>
          </DialogHeader>

          {diaSelecionado && diaSelecionado.transacoes.length > 0 ? (
            <div className="space-y-2">
              {diaSelecionado.transacoes.map((t, idx) => {
                const encargos = somarEncargos([t]);
                const comEncargo = temEncargo(encargos);
                const bruto = Number(t.valor);
                const liquido = Number(t.valor_liquido ?? t.valor);
                const cor = t.tipo === 'entrada' ? 'text-green-600' : 'text-red-600';
                const sinal = t.tipo === 'entrada' ? '+' : '-';
                return (
                  <div key={idx} className="text-sm border-b pb-2">
                    <div className="flex items-center justify-between">
                      <span className="text-foreground">{t.descricao}</span>
                      <span className={`font-semibold ml-4 ${cor}`}>
                        {sinal}{formatValue(bruto)}
                      </span>
                    </div>
                    {comEncargo && (
                      <EncargoBadges
                        totais={encargos}
                        formatCurrency={formatValue}
                        bruto={bruto}
                        liquido={liquido}
                        className="justify-end mt-1"
                      />
                    )}
                  </div>
                );
              })}
              {(() => {
                const totalEntradas = diaSelecionado.transacoes.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + Number(t.valor), 0);
                const totalSaidas = diaSelecionado.transacoes.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + Number(t.valor), 0);
                const totalDia = totalEntradas - totalSaidas;
                const totalEntradasLiquido = diaSelecionado.transacoes.filter(t => t.tipo === 'entrada').reduce((sum, t) => sum + Number(t.valor_liquido ?? t.valor), 0);
                const totalSaidasLiquido = diaSelecionado.transacoes.filter(t => t.tipo === 'saida').reduce((sum, t) => sum + Number(t.valor_liquido ?? t.valor), 0);
                const totalDiaLiquido = totalEntradasLiquido - totalSaidasLiquido;
                const encargosDia = somarEncargos(diaSelecionado.transacoes);
                const comEncargoDia = temEncargo(encargosDia);
                return (
                  <div className="border-t pt-3 mt-3">
                    <div className="flex items-center justify-between font-bold">
                      <span>Total do Dia</span>
                      <span className={`text-lg ${totalDia >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {(totalDia >= 0 ? '+' : '') + formatValue(totalDia)}
                      </span>
                    </div>
                    {comEncargoDia && (
                      <EncargoBadges
                        totais={encargosDia}
                        formatCurrency={formatValue}
                        bruto={totalDia}
                        liquido={totalDiaLiquido}
                        className="justify-end mt-1"
                      />
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4">Nenhuma transação neste dia</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
