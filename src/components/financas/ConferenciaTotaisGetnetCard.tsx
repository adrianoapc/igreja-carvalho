import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { useHideValues } from "@/hooks/useHideValues";
import { useFilialId } from "@/hooks/useFilialId";
import { getPeriodoRange } from "@/features/financeiro/core/lib/periodo";
import { conferenciaTotaisGetnet } from "@/features/financeiro/core/api/getnetRecebivel.api";
import { Scale } from "lucide-react";

export function ConferenciaTotaisGetnetCard() {
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [contaId, setContaId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  // fin_conferencia_totais_getnet só valida igreja_id, não filial — trocar
  // de igreja/filial com o card montado sem limpar contaId faria continuar
  // mostrando os totais da conta antiga (de outra filial) em silêncio, já
  // que o RPC nem rejeitaria a chamada (achado do /code-review).
  useEffect(() => {
    setContaId("");
  }, [igrejaId, filialId, isAllFiliais]);

  const periodo = getPeriodoRange(selectedMonth, customRange);

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-conferencia-getnet", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase.from("contas").select("id, nome").eq("ativo", true).eq("igreja_id", igrejaId).order("nome");
      // Conta compartilhada (filial_id NULL) é visível em qualquer filial
      // (mesma convenção de RLS de sempre) e fin_conferencia_totais_getnet
      // não restringe por filial — eq() sozinho excluiria as compartilhadas.
      if (!isAllFiliais && filialId) query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId,
  });

  const { data: totais, isLoading } = useQuery({
    queryKey: ["conferencia-totais-getnet", igrejaId, filialId, isAllFiliais, contaId, periodo.inicio, periodo.fim],
    queryFn: () => conferenciaTotaisGetnet(contaId, periodo.inicio, periodo.fim),
    enabled: !!contaId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Scale className="w-4 h-4" /> Conferência de totais por período
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <AlertDescription className="text-xs">
            Somatório do lado da Oferta (cartão): bruto − MDR − deságio já
            lançado = esperado no banco. A comparação linha a linha com os
            créditos reais do extrato chega nas próximas fases da Conciliação
            Cartão Getnet — até lá, o card não mostra “diferença não
            explicada” (o número antigo somava todo crédito da conta, Pix e
            depósitos inclusos, e assustava sem significado).
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Conta</Label>
            <Select value={contaId} onValueChange={setContaId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {contas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <MonthPicker
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
            customRange={customRange}
            onCustomRangeChange={setCustomRange}
          />
        </div>

        {!contaId ? (
          <p className="text-sm text-muted-foreground">Selecione uma conta para ver a conferência.</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Calculando...</p>
        ) : totais ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Σ Oferta bruto (cartão)</span>
              <span>{formatValue(totais.oferta_bruto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">− Σ taxa administrativa (MDR)</span>
              <span>{formatValue(totais.taxa_mdr)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">− Σ deságio de antecipação lançado</span>
              <span>{formatValue(totais.desagio_lancado)}</span>
            </div>
            <div className="flex justify-between font-medium border-t pt-2">
              <span>= Esperado no banco</span>
              <span>{formatValue(totais.esperado_banco)}</span>
            </div>
            <p className="text-xs text-muted-foreground border-t pt-2">
              Comparação com créditos do extrato (linha a linha, só Getnet)
              chega nas fases seguintes da Conciliação Cartão.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
