import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  gerarCandidatosLoteAntecipacaoGetnet,
  vincularLoteAntecipacao,
  type CandidatoLoteAntecipacaoGetnet,
} from "@/features/financeiro/core/api/getnetRecebivel.api";
import type { LoteAntecipacao } from "@/features/financeiro/core/hooks/useLotesAntecipacao";
import { format, parseISO, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { Link2, Calendar } from "lucide-react";
import { BuscaManualDialog } from "@/components/financas/BuscaManualDialog";

interface VincularExtratoLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lote: LoteAntecipacao;
  onVinculado: () => void;
}

// Mesmo corte 60/30 de antes da extração do ScoreBadge (família "lote de
// antecipação" — fin_gerar_candidatos_lote_antecipacao_getnet, 0..100).
const SCORE_THRESHOLDS = { alta: 60, media: 30 };

export function VincularExtratoLoteDialog({
  open,
  onOpenChange,
  lote,
  onVinculado,
}: VincularExtratoLoteDialogProps) {
  const { formatValue } = useHideValues();

  // Âncora só pra badge de janela na UI — a RPC aplica a mesma regra.
  const dataAncora = lote.data_contratacao_contrato ? parseISO(lote.data_contratacao_contrato) : null;
  const dateWindow = useMemo(
    () =>
      dataAncora
        ? {
            inicio: format(subDays(dataAncora, 5), "yyyy-MM-dd"),
            fim: format(addDays(dataAncora, 30), "yyyy-MM-dd"),
          }
        : null,
    [dataAncora],
  );

  return (
    <BuscaManualDialog<CandidatoLoteAntecipacaoGetnet>
      open={open}
      onOpenChange={onOpenChange}
      title="Vincular Extrato ao Lote"
      icon={<Link2 className="w-5 h-5 text-primary" />}
      anchorCard={
        <div className="p-3 rounded-lg border bg-muted/40">
          <p className="text-xs text-muted-foreground mb-1">Lote de antecipação:</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Contrato {lote.contrato_registradora}</p>
              {lote.data_contratacao_contrato && (
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(lote.data_contratacao_contrato), "dd/MM/yyyy", { locale: ptBR })}
                </p>
              )}
            </div>
            <p className="font-bold text-sm">{formatValue(lote.valor_atual_contrato ?? 0)}</p>
          </div>
        </div>
      }
      contextBadge={
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {dateWindow ? (
              <>
                Sugestões entre{" "}
                {format(parseISO(dateWindow.inicio), "dd/MM", { locale: ptBR })} e{" "}
                {format(parseISO(dateWindow.fim), "dd/MM/yyyy", { locale: ptBR })}
              </>
            ) : (
              "Sem data de contrato — sugestões por texto/valor (use a busca)"
            )}
          </Badge>
        </div>
      }
      searchPlaceholder="Buscar por descrição do extrato..."
      queryKey={["candidatos-lote-antecipacao-getnet", lote.id, !!dateWindow]}
      queryFn={(busca) =>
        gerarCandidatosLoteAntecipacaoGetnet({
          loteId: lote.id,
          busca,
          // Com janela: cobre a faixa ±5/+30 inteira (RPC default 5000).
          // Sem âncora: top pontuados / busca (RPC default 100).
          limite: dateWindow ? 5000 : 100,
        })
      }
      getId={(c) => c.extrato_id}
      getScore={(c) => Number(c.score)}
      scoreThresholds={SCORE_THRESHOLDS}
      renderItem={(c) => ({
        label: c.descricao,
        dateStr: format(parseISO(c.data_transacao), "dd/MM/yyyy", { locale: ptBR }),
        value: Number(c.valor),
      })}
      onConfirm={async (ids) => {
        const res = await vincularLoteAntecipacao(lote.id, ids[0]);
        const desagio = Number(res.desagio ?? 0);
        return { successMessage: `Lote vinculado — deságio calculado: ${formatValue(desagio)}` };
      }}
      onConfirmed={onVinculado}
      confirmLabel="Confirmar Vínculo"
      emptyTitle="Nenhum crédito candidato encontrado"
      emptyHint="Amplie a busca ou confirme se o extrato do banco já foi importado"
    />
  );
}
