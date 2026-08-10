import { useQuery } from "@tanstack/react-query";
import { CreditCard, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { getPeriodoRange } from "@/features/financeiro/core/lib/periodo";

interface CartaoStatsCardProps {
  igrejaId?: string;
  filialId?: string | null;
  selectedMonth: Date;
  customRange: { from: Date; to: Date } | null;
}

interface StatsCartao {
  vendas_importadas: number;
  vinculadas_oferta: number;
  vinculadas_banco: number;
}

const STATS_VAZIAS: StatsCartao = {
  vendas_importadas: 0,
  vinculadas_oferta: 0,
  vinculadas_banco: 0,
};

/**
 * Card "Cartão" da tela de Extratos/Histórico (Ciclo 2, C2-2) — ao lado do
 * bloco de stats "Banco" já existente. Fonte: `fin_stats_cartao_getnet`
 * (agregação sobre `getnet_recebivel_lancamentos`, mesmos campos que o
 * ledger unificado usa — não é fonte de verdade paralela).
 *
 * Filtro de filial (`if (filialId)`, sem `isAllFiliais`) segue a convenção
 * já usada pelas OUTRAS queries deste mesmo arquivo (`contas`/`extratos`
 * em HistoricoExtratos.tsx) — não a de `LotesAntecipacaoTab.tsx`, que usa
 * `useFilialId()`/`isAllFiliais` (hook diferente, não disponível aqui via
 * `useAuthContext()`).
 */
export function CartaoStatsCard({
  igrejaId,
  filialId,
  selectedMonth,
  customRange,
}: CartaoStatsCardProps) {
  // Sem integração Getnet ativa (config ausente) é estado normal pra igrejas
  // que não usam Getnet — o card simplesmente não aparece, não é erro. Busca
  // TODAS as integrações que casam (não só a primeira) — pode haver mais de
  // uma (ex.: compartilhada + específica de outra filial após migração de
  // CNPJ); pegar só uma arbitrariamente misturaria dado de filial errada.
  const {
    data: integracoes,
    isLoading: loadingIntegracoes,
    isError: erroIntegracoes,
  } = useQuery({
    queryKey: ["integracoes-getnet-historico", igrejaId, filialId],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("integracoes_financeiras")
        .select("id")
        .eq("igreja_id", igrejaId)
        .eq("provedor", "getnet")
        .eq("status", "ativo");
      if (filialId) {
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!igrejaId,
    staleTime: 5 * 60 * 1000,
  });

  const periodo = getPeriodoRange(selectedMonth, customRange);
  const integracaoIds = (integracoes ?? []).map((i) => i.id);

  const {
    data: stats,
    isLoading: loadingStats,
    isError: erroStats,
  } = useQuery({
    queryKey: [
      "stats-cartao-getnet",
      integracaoIds,
      filialId,
      periodo.inicio,
      periodo.fim,
    ],
    queryFn: async (): Promise<StatsCartao> => {
      // Soma as N integrações — cada uma valida tenant/filial no banco
      // (fin_stats_cartao_getnet), então agregar aqui não vaza escopo.
      const resultados = await Promise.all(
        integracaoIds.map(async (integracaoId) => {
          // fin_* ainda não está nos tipos gerados — mesmo padrão de conciliacao.api.ts.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { data, error } = await (supabase.rpc as any)(
            "fin_stats_cartao_getnet",
            {
              p_integracao_id: integracaoId,
              p_periodo_inicio: periodo.inicio,
              p_periodo_fim: periodo.fim,
              p_filial_id: filialId ?? null,
            },
          );
          if (error) throw error;
          return (data?.[0] ?? STATS_VAZIAS) as StatsCartao;
        }),
      );
      return resultados.reduce(
        (acc, r) => ({
          vendas_importadas: acc.vendas_importadas + r.vendas_importadas,
          vinculadas_oferta: acc.vinculadas_oferta + r.vinculadas_oferta,
          vinculadas_banco: acc.vinculadas_banco + r.vinculadas_banco,
        }),
        { ...STATS_VAZIAS },
      );
    },
    enabled: integracaoIds.length > 0,
  });

  if (loadingIntegracoes || !igrejaId) return null;

  // Erro real (RLS/rede) — distinto de "sem integração configurada", que é
  // estado normal e não deve aparecer como card algum.
  if (erroIntegracoes) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4" />
          Erro ao carregar dados do Cartão
        </div>
      </Card>
    );
  }

  if (integracaoIds.length === 0) return null;

  const isLoading = loadingStats;

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-medium">Cartão</span>
      </div>
      {erroStats ? (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4" />
          Erro ao carregar estatísticas
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <div className="text-xs text-muted-foreground">
              Vendas importadas
            </div>
            <div className="text-xl font-bold">
              {isLoading ? "…" : (stats?.vendas_importadas ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Vinculadas à oferta
            </div>
            <div className="text-xl font-bold">
              {isLoading ? "…" : (stats?.vinculadas_oferta ?? 0)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              Vinculadas ao banco
            </div>
            <div className="text-xl font-bold">
              {isLoading ? "…" : (stats?.vinculadas_banco ?? 0)}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
