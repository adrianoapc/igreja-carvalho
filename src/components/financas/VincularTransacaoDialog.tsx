import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { confirmarConciliacao } from "@/features/financeiro/core/api/conciliacao.api";
import { format, parseISO, differenceInDays, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { Link2 } from "lucide-react";
import { BuscaManualDialog } from "@/components/financas/BuscaManualDialog";

interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_pagamento: string;
  categorias_financeiras?: { nome: string } | null;
}

interface TransacaoComScore extends Transacao {
  score: number;
}

interface ExtratoItem {
  id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  reconciliado: boolean;
  transacao_vinculada_id?: string | null;
}

interface VincularTransacaoDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extrato: ExtratoItem;
  onVinculado: () => void;
}

// Corte próprio desta tela, inalterado desde antes da extração do ScoreBadge
// (não é a mesma família de Hop 1/2 nem de lote de antecipação).
const SCORE_THRESHOLDS = { alta: 80, media: 50 };

export function VincularTransacaoDialog({
  open,
  onOpenChange,
  extrato,
  onVinculado,
}: VincularTransacaoDialogProps) {
  const { formatValue } = useHideValues();
  const { igrejaId } = useIgrejaId();
  const { filialId, isAllFiliais } = useFilialId();

  const dateWindow = useMemo(() => {
    const dataExtrato = parseISO(extrato.data_transacao);
    return {
      inicio: format(subDays(dataExtrato, 60), "yyyy-MM-dd"),
      fim: format(addDays(dataExtrato, 60), "yyyy-MM-dd"),
      inicioFormatado: format(subDays(dataExtrato, 60), "dd/MM", { locale: ptBR }),
      fimFormatado: format(addDays(dataExtrato, 60), "dd/MM/yyyy", { locale: ptBR }),
    };
  }, [extrato.data_transacao]);

  const tipoExtrato = extrato.tipo === "credito" || extrato.tipo === "CREDIT" ? "entrada" : "saida";

  return (
    <BuscaManualDialog<TransacaoComScore>
      open={open}
      onOpenChange={onOpenChange}
      title="Vincular Transação"
      icon={<Link2 className="w-5 h-5 text-primary" />}
      anchorCard={
        <div
          className={`p-3 rounded-lg border ${
            extrato.tipo === "credito" || extrato.tipo === "CREDIT"
              ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
          }`}
        >
          <p className="text-xs text-muted-foreground mb-1">Extrato Bancário a Vincular:</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{extrato.descricao}</p>
              <p className="text-xs text-muted-foreground">
                {format(parseISO(extrato.data_transacao), "dd/MM/yyyy", { locale: ptBR })}
              </p>
            </div>
            <p
              className={`font-bold ${
                extrato.tipo === "credito" || extrato.tipo === "CREDIT" ? "text-green-600" : "text-red-600"
              }`}
            >
              {formatValue(extrato.valor)}
            </p>
          </div>
        </div>
      }
      contextBadge={
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground border rounded-md px-2 py-1">
            Buscando: {dateWindow.inicioFormatado} a {dateWindow.fimFormatado} (±60 dias)
          </span>
        </div>
      }
      searchPlaceholder="Buscar por descrição ou categoria..."
      queryKey={[
        "transacoes-para-vincular",
        extrato.id,
        igrejaId,
        filialId,
        isAllFiliais,
        dateWindow.inicio,
        dateWindow.fim,
      ]}
      // Busca client-side (janela ±60d já vem inteira) — serverSearch=false
      // evita re-fetch do Supabase a cada tecla (comportamento pré-extração).
      serverSearch={false}
      matchesSearch={(t, term) =>
        t.descricao.toLowerCase().includes(term) ||
        (t.categorias_financeiras?.nome?.toLowerCase().includes(term) ?? false)
      }
      queryFn={async () => {
        if (!igrejaId) return [];

        let transacaoQuery = supabase
          .from("transacoes_financeiras")
          .select("id, descricao, valor, tipo, data_pagamento, categorias_financeiras(nome)")
          .eq("igreja_id", igrejaId)
          .eq("status", "pago")
          .gte("data_pagamento", dateWindow.inicio)
          .lte("data_pagamento", dateWindow.fim)
          .order("data_pagamento", { ascending: false });

        if (!isAllFiliais && filialId) {
          transacaoQuery = transacaoQuery.eq("filial_id", filialId);
        }

        const { data: transacoes, error: transacoesError } = await transacaoQuery;
        if (transacoesError) {
          console.error("Erro ao buscar transações:", transacoesError);
          return [];
        }

        const { data: vinculados, error: vinculadosError } = await supabase
          .from("extratos_bancarios")
          .select("transacao_vinculada_id")
          .not("transacao_vinculada_id", "is", null);
        if (vinculadosError) {
          console.error("Erro ao buscar vinculados:", vinculadosError);
        }

        const idsVinculados = new Set(
          vinculados?.map((e) => e.transacao_vinculada_id).filter(Boolean) || [],
        );

        const disponiveis = (transacoes || []).filter((t) => !idsVinculados.has(t.id)) as Transacao[];

        const comScore: TransacaoComScore[] = disponiveis.map((t) => {
          let score = 0;
          if (t.tipo === tipoExtrato) score += 40;

          const diferencaValor = Math.abs(Number(t.valor) - extrato.valor);
          if (diferencaValor === 0) score += 40;
          else if (diferencaValor <= 1) score += 30;
          else if (diferencaValor <= 10) score += 20;
          else if (diferencaValor <= 50) score += 10;

          try {
            if (t.data_pagamento) {
              const diffDias = Math.abs(
                differenceInDays(parseISO(extrato.data_transacao), parseISO(t.data_pagamento)),
              );
              if (diffDias === 0) score += 20;
              else if (diffDias <= 1) score += 15;
              else if (diffDias <= 3) score += 10;
              else if (diffDias <= 7) score += 5;
            }
          } catch {
            // Invalid date
          }

          return { ...t, score };
        });

        return comScore.sort((a, b) => b.score - a.score);
      }}
      getId={(t) => t.id}
      getScore={(t) => t.score}
      scoreThresholds={SCORE_THRESHOLDS}
      renderItem={(t) => ({
        label: t.descricao,
        dateStr: t.data_pagamento ? format(parseISO(t.data_pagamento), "dd/MM/yyyy", { locale: ptBR }) : undefined,
        sublabel: t.categorias_financeiras?.nome,
        value: Number(t.valor),
        valueClassName: t.tipo === "entrada" ? "text-green-600" : "text-red-600",
      })}
      onConfirm={async (ids) => {
        // fin_confirmar_conciliacao cobre o vínculo 1:1 numa única transação:
        // flags do extrato, conciliacao_status + baixa pendente->pago da
        // transação e sincronismo da perna irmã de transferência (F3/F7).
        await confirmarConciliacao({
          extrato_ids: [extrato.id],
          transacao_ids: ids,
        });
        return { successMessage: "Transação vinculada com sucesso!" };
      }}
      onConfirmed={onVinculado}
      confirmLabel="Confirmar Vinculação"
      emptyTitle="Nenhuma transação candidata encontrada"
      emptyHint="Verifique se há transações pagas no período"
    />
  );
}
