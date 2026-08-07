import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFilialId } from "@/hooks/useFilialId";
import { ConciliacaoCartaoLedger } from "@/components/financas/ConciliacaoCartaoLedger";
import { ConferenciaTotaisGetnetCard } from "@/components/financas/ConferenciaTotaisGetnetCard";
import { MonthPicker } from "@/components/financas/MonthPicker";
import { getPeriodoRange } from "@/features/financeiro/core/lib/periodo";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

type IntegracaoOption = { id: string; nome: string };

/**
 * Fase 7b — "Conciliação Cartão" evolui de 3 tabelas empilhadas (Hop 2, Hop 1,
 * lotes — Fase 6) pro ledger unificado por lançamento (`ConciliacaoCartaoLedger`,
 * fin_listar_ledger_conciliacao_cartao). Esta aba continua dona só do estado
 * de filtro (integração/conta/período) e da conferência de totais.
 */
export function LotesAntecipacaoTab() {
  const { igrejaId, filialId, isAllFiliais } = useFilialId();

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
    // RLS de integracoes_financeiras é só tenant-scoped — o filtro de
    // filial precisa ser client-side (mesma classe §9.65 / review #82).
    queryKey: ["integracoes-getnet-conciliacao-cartao", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("integracoes_financeiras")
        .select("id, cnpj")
        .eq("igreja_id", igrejaId)
        .eq("provedor", "getnet")
        .eq("status", "ativo");
      // Integração compartilhada (filial_id NULL) é visível em qualquer filial.
      // Sem .or(), tesoureiro de filial B selecionava integração da A e o RPC
      // rejeitava com FIN_TENANT — UI mostrava "nenhuma sugestão" (review #82).
      if (!isAllFiliais && filialId) {
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((i) => ({ id: i.id, nome: `Getnet · ${i.cnpj}` }));
    },
    enabled: !!igrejaId,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (integracaoId && integracoes.length > 0 && !integracoes.some((i) => i.id === integracaoId)) {
      setIntegracaoId("");
      return;
    }
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
    if (contaId && contas.length > 0 && !contas.some((c) => c.id === contaId)) {
      setContaId("");
      return;
    }
    if (!contaId && contas.length === 1) {
      setContaId(contas[0].id);
    }
  }, [contas, contaId]);

  const ledgerFilters = {
    integracaoId,
    contaId,
    periodoInicio: periodo.inicio,
    periodoFim: periodo.fim,
    filialId: filialFiltro,
    enabled: !!igrejaId,
  };

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Conciliação Cartão Getnet — cada lançamento de oferta em cartão, do bruto do culto até o
          crédito real no banco, numa linha só. Nada é vinculado automaticamente: a escolha
          continua do tesoureiro.
        </AlertDescription>
      </Alert>

      <div className="border rounded-lg p-3 space-y-3">
        <p className="text-sm font-medium">Filtros do período</p>
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
            <Label className="text-xs">Conta (ledger + conferência)</Label>
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

      <ConciliacaoCartaoLedger filters={ledgerFilters} />
    </div>
  );
}
