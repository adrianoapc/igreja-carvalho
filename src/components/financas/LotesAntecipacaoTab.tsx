import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useHideValues } from "@/hooks/useHideValues";
import { useFilialId } from "@/hooks/useFilialId";
import {
  useLotesAntecipacao,
  calcularDesagio,
  type LoteAntecipacao,
} from "@/features/financeiro/core/hooks/useLotesAntecipacao";
import { VincularExtratoLoteDialog } from "@/components/financas/VincularExtratoLoteDialog";
import { LancarDesagioDialog } from "@/components/financas/LancarDesagioDialog";
import { ConferenciaTotaisGetnetCard } from "@/components/financas/ConferenciaTotaisGetnetCard";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { getPeriodoRange } from "@/features/financeiro/core/lib/periodo";
import { supabase } from "@/integrations/supabase/client";
import {
  ConciliacaoCartaoIntro,
  Hop1VendaBancoSection,
  Hop2OfertaVendaSection,
} from "@/components/financas/ConciliacaoCartaoHopSections";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Link2, TrendingDown, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const STATUS_LABEL: Record<LoteAntecipacao["status"], string> = {
  pendente_vinculo: "Pendente de vínculo",
  vinculado: "Vinculado",
  lancamento_criado: "Deságio lançado",
};

function StatusBadge({ status }: { status: LoteAntecipacao["status"] }) {
  if (status === "lancamento_criado") {
    return (
      <Badge className="bg-green-500 text-white gap-1">
        <CheckCircle2 className="w-3 h-3" /> {STATUS_LABEL[status]}
      </Badge>
    );
  }
  if (status === "vinculado") {
    return (
      <Badge className="bg-blue-500 text-white gap-1">
        <Link2 className="w-3 h-3" /> {STATUS_LABEL[status]}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="gap-1">
      <AlertCircle className="w-3 h-3" /> {STATUS_LABEL[status]}
    </Badge>
  );
}

type IntegracaoOption = { id: string; nome: string };

/**
 * Fase 6 — tela consolidada "Conciliação Cartão" (evolução da aba de lotes).
 * 3 seções por período: Hop 2, Hop 1 sem antecipação, lotes de antecipação.
 * Confirmação sempre explícita (checkbox + confirmar N) — sem auto-vínculo.
 */
export function LotesAntecipacaoTab() {
  const { formatValue } = useHideValues();
  const queryClient = useQueryClient();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const { data: lotes = [], isLoading, refetch } = useLotesAntecipacao();
  const [loteVinculando, setLoteVinculando] = useState<LoteAntecipacao | null>(null);
  const [loteLancando, setLoteLancando] = useState<LoteAntecipacao | null>(null);

  const [integracaoId, setIntegracaoId] = useState("");
  const [contaId, setContaId] = useState("");
  const [selectedMonth, setSelectedMonth] = useState<Date>(new Date());
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  useEffect(() => {
    setIntegracaoId("");
    setContaId("");
  }, [igrejaId, filialId, isAllFiliais]);

  const periodo = getPeriodoRange(selectedMonth, customRange);
  const filialFiltro = !isAllFiliais && filialId ? filialId : null;

  const { data: integracoes = [] } = useQuery<IntegracaoOption[]>({
    queryKey: ["integracoes-getnet-conciliacao-cartao", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data, error } = await supabase
        .from("integracoes_financeiras")
        .select("id, cnpj")
        .eq("igreja_id", igrejaId)
        .eq("provedor", "getnet")
        .eq("status", "ativo");
      if (error) throw error;
      return (data || []).map((i) => ({ id: i.id, nome: `Getnet · ${i.cnpj}` }));
    },
    enabled: !!igrejaId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (!integracaoId && integracoes.length === 1) {
      setIntegracaoId(integracoes[0].id);
    }
  }, [integracoes, integracaoId]);

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-conciliacao-cartao", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!igrejaId,
  });

  useEffect(() => {
    if (!contaId && contas.length === 1) {
      setContaId(contas[0].id);
    }
  }, [contas, contaId]);

  const hopFilters = {
    integracaoId,
    contaId,
    periodoInicio: periodo.inicio,
    periodoFim: periodo.fim,
    filialId: filialFiltro,
    enabled: !!igrejaId,
  };

  return (
    <div className="space-y-4">
      <ConciliacaoCartaoIntro />

      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-medium">Filtros do período (Hop 1 / Hop 2)</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Integração Getnet</Label>
            <Select value={integracaoId} onValueChange={setIntegracaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a integração" />
              </SelectTrigger>
              <SelectContent>
                {integracoes.map((i) => (
                  <SelectItem key={i.id} value={i.id}>
                    {i.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Conta (Hop 1 + conferência)</Label>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Período</Label>
            <MonthPicker
              selectedMonth={selectedMonth}
              onMonthChange={setSelectedMonth}
              customRange={customRange}
              onCustomRangeChange={setCustomRange}
            />
          </div>
        </div>
      </div>

      <ConferenciaTotaisGetnetCard
        contaId={contaId}
        onContaIdChange={setContaId}
        selectedMonth={selectedMonth}
        onSelectedMonthChange={setSelectedMonth}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
        hideFilters
      />

      <Hop2OfertaVendaSection filters={hopFilters} />
      <Hop1VendaBancoSection filters={hopFilters} />

      <section className="border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/40 border-b font-medium text-sm">
          <Link2 className="w-4 h-4" />
          <span>Lotes de antecipação</span>
          <Badge variant="secondary" className="font-normal">
            {lotes.length}
          </Badge>
        </div>
        <div className="px-3 py-2 text-xs text-muted-foreground border-b">
          Vínculo e deságio continuam por lote (dialog) — cada antecipação precisa
          da escolha explícita do crédito bancário entre os candidatos sugeridos.
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : lotes.length === 0 ? (
          <div className="text-center p-12 text-muted-foreground text-sm">
            Nenhum lote de antecipação importado ainda.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-3 py-2 text-left">Contrato</th>
                  <th className="px-3 py-2 text-left">Data</th>
                  <th className="px-3 py-2 text-right">Valor do contrato</th>
                  <th className="px-3 py-2 text-right">Deságio</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {lotes.map((lote) => {
                  const desagio = calcularDesagio(lote);
                  return (
                    <tr key={lote.id} className="border-t">
                      <td className="px-3 py-2 font-mono text-xs">{lote.contrato_registradora}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {lote.data_contratacao_contrato
                          ? format(parseISO(lote.data_contratacao_contrato), "dd/MM/yyyy", {
                              locale: ptBR,
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {formatValue(lote.valor_atual_contrato ?? 0)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {desagio != null ? (
                          <span className="text-destructive font-medium">
                            {formatValue(desagio)}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <StatusBadge status={lote.status} />
                      </td>
                      <td className="px-3 py-2 text-right">
                        {lote.status === "pendente_vinculo" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setLoteVinculando(lote)}
                          >
                            <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular extrato
                          </Button>
                        )}
                        {lote.status === "vinculado" && (
                          <div className="flex justify-end gap-2">
                            {/* fin_vincular_lote_antecipacao permite trocar o
                                vínculo até o deságio ser lançado — mantém a
                                ação disponível pro caso de extrato errado ou
                                deságio não-positivo rejeitado pela RPC de
                                lançamento (achado do /code-review). */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setLoteVinculando(lote)}
                            >
                              <Link2 className="w-3.5 h-3.5 mr-1" /> Corrigir vínculo
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => setLoteLancando(lote)}
                            >
                              <TrendingDown className="w-3.5 h-3.5 mr-1" /> Lançar como saída
                            </Button>
                          </div>
                        )}
                        {lote.status === "lancamento_criado" && (
                          <span className="text-xs text-muted-foreground">Concluído</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {loteVinculando && (
        <VincularExtratoLoteDialog
          open={!!loteVinculando}
          onOpenChange={(open) => !open && setLoteVinculando(null)}
          lote={loteVinculando}
          onVinculado={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["conferencia-totais-getnet"] });
            queryClient.invalidateQueries({ queryKey: ["candidatos-venda-banco-getnet"] });
            setLoteVinculando(null);
          }}
        />
      )}

      {loteLancando && (
        <LancarDesagioDialog
          open={!!loteLancando}
          onOpenChange={(open) => !open && setLoteLancando(null)}
          lote={loteLancando}
          onLancado={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["conferencia-totais-getnet"] });
            setLoteLancando(null);
          }}
        />
      )}
    </div>
  );
}
