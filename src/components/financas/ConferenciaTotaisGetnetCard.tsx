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
import { Scale, AlertTriangle, CheckCircle2 } from "lucide-react";

const CENTAVOS_TOLERANCIA = 0.01;

export interface ConferenciaTotaisGetnetCardProps {
  /** Conta controlada pelo pai (Fase 6 — filtros compartilhados). */
  contaId?: string;
  onContaIdChange?: (id: string) => void;
  selectedMonth?: Date;
  onSelectedMonthChange?: (month: Date) => void;
  customRange?: { from: Date; to: Date } | null;
  onCustomRangeChange?: (range: { from: Date; to: Date } | null) => void;
  /** Esconde o seletor interno quando o pai já mostra os filtros. */
  hideFilters?: boolean;
}

export function ConferenciaTotaisGetnetCard({
  contaId: contaIdProp,
  onContaIdChange,
  selectedMonth: selectedMonthProp,
  onSelectedMonthChange,
  customRange: customRangeProp,
  onCustomRangeChange,
  hideFilters = false,
}: ConferenciaTotaisGetnetCardProps = {}) {
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [contaIdInterno, setContaIdInterno] = useState("");
  const [selectedMonthInterno, setSelectedMonthInterno] = useState<Date>(new Date());
  const [customRangeInterno, setCustomRangeInterno] = useState<{
    from: Date;
    to: Date;
  } | null>(null);

  const controlled = onContaIdChange != null;
  const contaId = controlled ? (contaIdProp ?? "") : contaIdInterno;
  const setContaId = controlled ? onContaIdChange! : setContaIdInterno;

  const monthControlled = onSelectedMonthChange != null;
  const selectedMonth = monthControlled
    ? (selectedMonthProp ?? new Date())
    : selectedMonthInterno;
  const setSelectedMonth = monthControlled
    ? onSelectedMonthChange!
    : setSelectedMonthInterno;

  const rangeControlled = onCustomRangeChange != null;
  const customRange = rangeControlled
    ? (customRangeProp ?? null)
    : customRangeInterno;
  const setCustomRange = rangeControlled
    ? onCustomRangeChange!
    : setCustomRangeInterno;

  // Trocar de igreja/filial com o card montado sem limpar contaId faria
  // continuar mostrando totais da conta antiga em silêncio.
  useEffect(() => {
    if (!controlled) setContaIdInterno("");
  }, [igrejaId, filialId, isAllFiliais, controlled]);

  const periodo = getPeriodoRange(selectedMonth, customRange);

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-conferencia-getnet", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase.from("contas").select("id, nome").eq("ativo", true).eq("igreja_id", igrejaId).order("nome");
      // Conta compartilhada (filial_id NULL) é visível em qualquer filial.
      if (!isAllFiliais && filialId) query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId && !hideFilters,
  });

  const { data: totais, isLoading } = useQuery({
    queryKey: ["conferencia-totais-getnet", igrejaId, filialId, isAllFiliais, contaId, periodo.inicio, periodo.fim],
    queryFn: () => conferenciaTotaisGetnet(contaId, periodo.inicio, periodo.fim),
    enabled: !!contaId,
  });

  const diferenca = totais?.diferenca_nao_explicada ?? 0;
  const bate = Math.abs(diferenca) <= CENTAVOS_TOLERANCIA;

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
            Oferta (cartão) bruto − MDR − deságio = esperado no banco, comparado
            só aos créditos com vínculo Getnet (Hop 1 ou lote de antecipação) —
            não soma Pix/depósito. Diferença ≠ 0 pode significar venda ainda
            sem Hop 1, lote sem vínculo ou erro de digitação; não decide
            sozinho, só torna visível.
          </AlertDescription>
        </Alert>

        {!hideFilters && (
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
        )}

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
            <div className="flex justify-between">
              <span className="text-muted-foreground">Σ Banco creditado (Getnet vinculado)</span>
              <span>{formatValue(totais.banco_creditado)}</span>
            </div>
            <div
              className={`flex justify-between items-center font-bold border-t pt-2 ${
                bate ? "text-green-600" : "text-destructive"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {bate ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                Diferença não explicada
              </span>
              <span>{formatValue(diferenca)}</span>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
