import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { vincularLoteAntecipacao } from "@/features/financeiro/core/api/getnetRecebivel.api";
import type { LoteAntecipacao } from "@/features/financeiro/core/hooks/useLotesAntecipacao";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useHideValues } from "@/hooks/useHideValues";
import { useFilialId } from "@/hooks/useFilialId";
import { Loader2, Search, Link2, CheckCircle2, AlertCircle, Calendar } from "lucide-react";

interface ExtratoCandidato {
  id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  score: number;
}

interface VincularExtratoLoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lote: LoteAntecipacao;
  onVinculado: () => void;
}

// Sugestão visual, sem auto-selecionar (decisão do usuário) — só ordena e
// destaca; a escolha final é sempre manual.
function pontuarCandidato(
  e: { data_transacao: string; descricao: string; valor: number },
  dataAncora: Date,
  valorEsperado: number | null,
): number {
  let score = 0;
  const desc = e.descricao.toLowerCase();
  if (desc.includes("antecipa") || desc.includes("getnet")) score += 40;

  try {
    const diffDias = Math.abs(differenceInDays(dataAncora, parseISO(e.data_transacao)));
    if (diffDias === 0) score += 30;
    else if (diffDias <= 3) score += 20;
    else if (diffDias <= 10) score += 10;
  } catch {
    // data inválida, sem pontos
  }

  if (valorEsperado != null) {
    const diferenca = Math.abs(e.valor - valorEsperado);
    if (diferenca <= 1) score += 30;
    else if (diferenca / valorEsperado <= 0.2) score += 15;
  }

  return score;
}

export function VincularExtratoLoteDialog({
  open,
  onOpenChange,
  lote,
  onVinculado,
}: VincularExtratoLoteDialogProps) {
  const { formatValue } = useHideValues();
  const { igrejaId, filialId, isAllFiliais } = useFilialId();
  const [loading, setLoading] = useState(false);
  const [selectedExtratoId, setSelectedExtratoId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Antecipação normalmente credita perto da data de contratação do lote;
  // ±30 dias cobre atraso de liquidação sem trazer ruído demais.
  const dataAncora = lote.data_contratacao_contrato
    ? parseISO(lote.data_contratacao_contrato)
    : new Date();
  const dateWindow = useMemo(
    () => ({
      inicio: format(subDays(dataAncora, 5), "yyyy-MM-dd"),
      fim: format(addDays(dataAncora, 30), "yyyy-MM-dd"),
    }),
    [dataAncora],
  );

  const { data: candidatos = [], isLoading } = useQuery({
    queryKey: ["extratos-para-vincular-lote", lote.id, igrejaId, filialId, isAllFiliais, dateWindow.inicio, dateWindow.fim],
    queryFn: async () => {
      if (!igrejaId) return [];

      let query = supabase
        .from("extratos_bancarios")
        .select("id, data_transacao, descricao, valor")
        .eq("igreja_id", igrejaId)
        .eq("tipo", "credito")
        .order("data_transacao", { ascending: false });
      // Sem data_contratacao_contrato (import histórico sem essa coluna
      // preenchida), dataAncora cai pra hoje — aplicar a janela ±5/+30 dias
      // em torno de "hoje" excluiria o crédito real de um contrato antigo.
      // Sem âncora confiável, não filtra por data: busca por texto + score
      // (que já degrada sozinho sem dataAncora útil) seguem disponíveis pra
      // achar manualmente (achado do /code-review).
      if (lote.data_contratacao_contrato) {
        query = query.gte("data_transacao", dateWindow.inicio).lte("data_transacao", dateWindow.fim);
      }
      // Lote com filial definida só pode vincular extrato da mesma filial
      // (fin_vincular_lote_antecipacao valida isso no backend desde
      // 20260731100000) — escopa por ela sempre, independente da visão
      // "todas as filiais". Lote sem filial (global) segue o seletor normal.
      if (lote.filial_id) {
        query = query.eq("filial_id", lote.filial_id);
      } else if (!isAllFiliais && filialId) {
        // Lote global: fin_vincular_lote_antecipacao checa has_filial_access
        // contra a filial do EXTRATO nesse caso (COALESCE(lote.filial_id,
        // extrato.filial_id)) — extrato da própria filial ou compartilhado
        // (filial_id NULL) passam; eq() sozinho excluiria os compartilhados.
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      }

      const { data: extratos, error } = await query;
      if (error) throw error;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: outrosLotes } = await (supabase.from as any)("getnet_antecipacao_lotes")
        .select("extrato_bancario_id")
        .not("extrato_bancario_id", "is", null)
        .neq("id", lote.id);
      const jaVinculados = new Set(
        (outrosLotes ?? []).map((l: { extrato_bancario_id: string }) => l.extrato_bancario_id),
      );

      const disponiveis = (extratos ?? []).filter((e) => !jaVinculados.has(e.id));
      return disponiveis
        .map((e) => ({
          ...e,
          score: pontuarCandidato(e, dataAncora, lote.valor_atual_contrato),
        }))
        .sort((a, b) => b.score - a.score) as ExtratoCandidato[];
    },
    enabled: open && !!igrejaId,
  });

  const candidatosFiltrados = useMemo(() => {
    if (!searchTerm) return candidatos;
    const s = searchTerm.toLowerCase();
    return candidatos.filter((c) => c.descricao.toLowerCase().includes(s));
  }, [candidatos, searchTerm]);

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
      toast.error("Erro ao vincular lote ao extrato");
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
            Buscando créditos entre{" "}
            {format(parseISO(dateWindow.inicio), "dd/MM", { locale: ptBR })} e{" "}
            {format(parseISO(dateWindow.fim), "dd/MM/yyyy", { locale: ptBR })}
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
          ) : candidatosFiltrados.length > 0 ? (
            <RadioGroup
              value={selectedExtratoId || ""}
              onValueChange={setSelectedExtratoId}
              className="p-2 space-y-2"
            >
              {candidatosFiltrados.map((c) => (
                <div
                  key={c.id}
                  className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedExtratoId === c.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedExtratoId(c.id)}
                >
                  <RadioGroupItem value={c.id} id={c.id} className="mt-1" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-2 mb-1 flex-wrap">
                      <Label htmlFor={c.id} className="font-medium text-sm cursor-pointer break-words">
                        {c.descricao}
                      </Label>
                      {getScoreBadge(c.score)}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {format(parseISO(c.data_transacao), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="font-bold text-sm whitespace-nowrap shrink-0 text-green-600">
                    {formatValue(c.valor)}
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
