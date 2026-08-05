import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import {
  gerarCandidatosLoteAntecipacaoGetnet,
  vincularLoteAntecipacao,
} from "@/features/financeiro/core/api/getnetRecebivel.api";
import type { LoteAntecipacao } from "@/features/financeiro/core/hooks/useLotesAntecipacao";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { Loader2, Search, Link2, CheckCircle2, AlertCircle, Calendar } from "lucide-react";

interface VincularExtratoLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lote: LoteAntecipacao;
  onVinculado: () => void;
}

export function VincularExtratoLoteDialog({
  open,
  onOpenChange,
  lote,
  onVinculado,
}: VincularExtratoLoteDialogProps) {
  const { formatValue } = useHideValues();
  const [loading, setLoading] = useState(false);
  const [selectedExtratoId, setSelectedExtratoId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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

  // Fase 5: candidatos via SECURITY DEFINER (has_filial_access, exclui Hop 1 /
  // outro lote / reconciliado). Sem auto-selecionar — escolha continua manual.
  const buscaRpc = searchTerm.trim() || null;
  const { data: candidatos = [], isLoading } = useQuery({
    queryKey: ["candidatos-lote-antecipacao-getnet", lote.id, buscaRpc],
    queryFn: () =>
      gerarCandidatosLoteAntecipacaoGetnet({
        loteId: lote.id,
        busca: buscaRpc,
        limite: 100,
      }),
    enabled: open,
  });

  const handleVincular = async () => {
    if (!selectedExtratoId) {
      toast.error("Selecione uma linha de extrato para vincular");
      return;
    }
    setLoading(true);
    try {
      const res = await vincularLoteAntecipacao(lote.id, selectedExtratoId);
      const desagio = Number(res.desagio ?? 0);
      toast.success(`Lote vinculado — deságio calculado: ${formatValue(desagio)}`);
      onVinculado();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : "Erro ao vincular lote ao extrato";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const getScoreBadge = (score: number) => {
    if (score >= 60) return <Badge className="bg-green-500 text-white">Alta ({score}%)</Badge>;
    if (score >= 30) return <Badge className="bg-yellow-500 text-white">Média ({score}%)</Badge>;
    return <Badge variant="secondary">Baixa ({score}%)</Badge>;
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      trigger={null}
      dialogContentProps={{ className: "max-w-xl max-h-[85vh] overflow-hidden flex flex-col" }}
    >
      <div className="space-y-4 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-2">
          <Link2 className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Vincular Extrato ao Lote</h2>
        </div>

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

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição do extrato..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[280px] border rounded-lg">
          {isLoading ? (
            <div className="flex items-center justify-center h-full p-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : candidatos.length > 0 ? (
            <RadioGroup
              value={selectedExtratoId || ""}
              onValueChange={setSelectedExtratoId}
              className="p-2 space-y-2"
            >
              {candidatos.map((c) => (
                <div
                  key={c.extrato_id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedExtratoId === c.extrato_id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedExtratoId(c.extrato_id)}
                >
                  <RadioGroupItem value={c.extrato_id} id={c.extrato_id} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      <Label htmlFor={c.extrato_id} className="font-medium text-sm cursor-pointer break-words">
                        {c.descricao}
                      </Label>
                      {getScoreBadge(Number(c.score))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(c.data_transacao), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="font-bold text-sm whitespace-nowrap shrink-0 text-green-600">
                    {formatValue(Number(c.valor))}
                  </p>
                </div>
              ))}
            </RadioGroup>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum crédito candidato encontrado</p>
              <p className="text-xs text-muted-foreground mt-1">
                Amplie a busca ou confirme se o extrato do banco já foi importado
              </p>
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleVincular} disabled={loading || !selectedExtratoId}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Confirmar Vínculo
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
