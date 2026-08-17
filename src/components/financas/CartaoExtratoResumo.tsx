import { useState } from "react";
import { ArrowRight, CreditCard } from "lucide-react";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "./MonthPicker";
import { CartaoStatsCard } from "./CartaoStatsCard";

interface CartaoExtratoResumoProps {
  onIrParaConciliacaoCartao: () => void;
}

/**
 * Resumo somente-leitura do lado Cartão dentro de Extratos — as ações de
 * vínculo (confirmar sugestão, buscar manualmente) continuam só na aba
 * "Conciliação Cartão", pra não duplicar aquele fluxo aqui.
 */
export function CartaoExtratoResumo({
  onIrParaConciliacaoCartao,
}: CartaoExtratoResumoProps) {
  const { igrejaId, filialId } = useAuthContext();
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Cartão
              </CardTitle>
              <p className="text-xs text-muted-foreground font-mono mt-1">
                getnet_recebivel_lancamentos + hops
              </p>
            </div>
            <MonthPicker
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <CartaoStatsCard
            igrejaId={igrejaId}
            filialId={filialId}
            selectedMonth={selectedMonth}
            customRange={customRange}
          />
          <Button variant="outline" onClick={onIrParaConciliacaoCartao}>
            Ver em Conciliação Cartão
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
