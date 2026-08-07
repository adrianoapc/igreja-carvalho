import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Landmark,
  Link2,
  Loader2,
  Search,
  TrendingDown,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useHideValues } from "@/hooks/useHideValues";
import { useLotesAntecipacao } from "@/features/financeiro/core/hooks/useLotesAntecipacao";
import {
  listarLedgerConciliacaoCartao,
  buscarRecebiveisGetnetOferta,
  vincularVendaGetnetOferta,
  gerarCandidatosVendaBancoGetnet,
  vincularVendaBancoGetnet,
  type CandidatoBuscaRecebivelOferta,
  type CandidatoVendaBancoGetnet,
  type LedgerCartaoLancamento,
  type LedgerCartaoLote,
} from "@/features/financeiro/core/api/getnetRecebivel.api";
import { ScoreBadge, rpcErrorMessage } from "@/components/financas/ScoreBadge";
import { BuscaManualDialog } from "@/components/financas/BuscaManualDialog";
import { VincularExtratoLoteDialog } from "@/components/financas/VincularExtratoLoteDialog";
import { LancarDesagioDialog } from "@/components/financas/LancarDesagioDialog";

// Busca manual do ledger (fin_buscar_recebiveis_getnet_oferta) é RPC irmã da
// família "lote de antecipação" — mesmo corte 60/30 (não é Hop 1/2, que usa
// 85/50 numa escala 0..1 tolerante).
const BUSCA_MANUAL_THRESHOLDS = { alta: 60, media: 30 };
// Sugestões Hop 1 (fin_gerar_candidatos_venda_banco_getnet) e Hop 2
// (fin_gerar_candidatos_oferta_venda_getnet) — mesma família/escala 0..1
// tolerante, mesmo corte 85/50 que ConciliacaoCartaoHopSections usava pras
// duas.
const SUGESTAO_HOP_THRESHOLDS = { alta: 85, media: 50 };

/**
 * Paleta de status validada (skill dataviz, references/palette.md) — 4 cores
 * reservadas, cada uma com ícone + rótulo (nunca só cor). O par âmbar/vermelho
 * herdado do app (`--destructive`) e do mockup original não separa (ΔE < 15
 * entre os dois, medido com `validate_palette.js` — abaixo do piso de visão
 * normal, não só daltonismo). Divergência é o status mais crítico da feature
 * (mismatch contábil real que a Fase 0-4 existe pra detectar), por isso ganhou
 * cor própria em vez de herdar o `--destructive` genérico do app — mudança
 * local a este componente, não toca o token global.
 */
const STATUS_COLOR = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

type StatusTone = keyof typeof STATUS_COLOR;

// Contraste de texto medido por swatch (WCAG relative luminance) — preto
// (tom "primary ink" do skill) pra good/warning/serious, branco só pra
// critical (é o único em que branco vence: 4.80:1 vs 4.37:1 de preto).
const STATUS_TEXT: Record<StatusTone, string> = {
  good: "#0b0b0b",
  warning: "#0b0b0b",
  serious: "#0b0b0b",
  critical: "#ffffff",
};

function pillStyle(tone: StatusTone): { backgroundColor: string; color: string } {
  return { backgroundColor: STATUS_COLOR[tone], color: STATUS_TEXT[tone] };
}

const STATUS_ICON: Record<StatusTone, typeof CheckCircle2> = {
  good: CheckCircle2,
  warning: Clock,
  serious: AlertTriangle,
  critical: AlertCircle,
};

function StatusPillBadge({ tone, label }: { tone: StatusTone; label: string }) {
  const Icon = STATUS_ICON[tone];
  return (
    <Badge style={pillStyle(tone)} className="whitespace-nowrap gap-1">
      <Icon className="w-3 h-3" />
      {label}
    </Badge>
  );
}

interface LedgerFilters {
  integracaoId: string;
  contaId: string;
  periodoInicio: string;
  periodoFim: string;
  filialId: string | null;
  enabled: boolean;
}

function formatDateSafe(iso: string | null | undefined, pattern = "dd/MM/yyyy"): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), pattern, { locale: ptBR });
  } catch {
    return iso;
  }
}

function nBatidas(l: LedgerCartaoLancamento): number {
  return l.parcelas.filter((p) => p.hop1_status === "fechado" || p.hop1_status === "antecipada").length;
}

/**
 * Casa a linha `aguardando_banco` com uma sugestão Hop 1
 * (fin_gerar_candidatos_venda_banco_getnet, que agrupa por
 * data_vencimento+filial no nível conta/período — não por lançamento; um
 * crédito pode cobrir parcelas de mais de uma oferta do mesmo dia, mesmo
 * comportamento que Hop1VendaBancoSection já tinha). Como o ledger não
 * carrega `recebivel_id` por parcela, o cruzamento é por
 * `data_vencimento_real` da parcela ainda `aguardando` (ignora `fechado`/
 * `antecipada`, já batidas) + filial compartilhada (`filial_id` null em
 * qualquer lado é "global", mesma regra do resto do domínio).
 *
 * Percorre as parcelas na ordem (`numero_parcela` — já vem ordenado do
 * RPC) e devolve o PRIMEIRO candidato encontrado: a linha tem 1 botão só,
 * não 1 por parcela. Se parcelas diferentes da mesma linha "aguardando"
 * apontarem pra datas distintas com candidatos diferentes, só a primeira
 * é oferecida — a ação continua individual (mesmo escopo que
 * Hop1VendaBancoSection sempre teve, um vínculo de cada vez).
 */
function encontrarCandidatoHop1(
  l: LedgerCartaoLancamento,
  candidatosPorData: Map<string, CandidatoVendaBancoGetnet[]>,
): CandidatoVendaBancoGetnet | null {
  for (const p of l.parcelas) {
    if (p.hop1_status !== "aguardando" || !p.data_vencimento_real) continue;
    const candidatos = candidatosPorData.get(p.data_vencimento_real);
    if (!candidatos || candidatos.length === 0) continue;
    const compativeis = candidatos.filter(
      (c) => c.filial_id === l.filial_id || c.filial_id == null || l.filial_id == null,
    );
    if (compativeis.length === 0) continue;
    return compativeis.reduce((melhor, c) => (c.score > melhor.score ? c : melhor));
  }
  return null;
}

function statusPill(l: LedgerCartaoLancamento): { label: string; tone: StatusTone } {
  switch (l.status) {
    case "fechado":
      return { label: "Fechado", tone: "good" };
    case "divergencia":
      return { label: "Divergência", tone: "critical" };
    case "sem_hop2":
      // Rótulo de exibição só — a chave interna (`sem_hop2`) não usa a
      // palavra do enum de lote (pendente_vinculo/vinculado/lancamento_criado).
      // Tom "serious", não "warning": Hop 2 nunca casou (precisa de ação do
      // tesoureiro), diferente de aguardando_banco (já casou, só falta o
      // banco confirmar sozinho).
      return { label: "Pendente vínculo", tone: "serious" };
    case "aguardando_banco":
      return {
        label: `Aguardando banco (${nBatidas(l)}/${l.total_parcelas})`,
        tone: "warning",
      };
    default:
      return { label: l.status, tone: "warning" };
  }
}

// Lotes não têm conceito de "crítico" (não há mismatch contábil possível
// nesse enum) — usa só good/warning da mesma paleta, pra manter o vocabulário
// de cor consistente com o resto do componente.
const LOTE_STATUS_META: Record<LedgerCartaoLote["status"], { label: string; tone: StatusTone }> = {
  lancamento_criado: { label: "Concluído", tone: "good" },
  vinculado: { label: "Vinculado — aguardando lançamento", tone: "warning" },
  pendente_vinculo: { label: "Pendente vínculo", tone: "warning" },
};

function ChainLink({ tone = "pending" }: { tone?: "good" | "pending" | "critical" }) {
  if (tone === "pending") {
    return <span className="flex items-center justify-center w-8 shrink-0 text-muted-foreground">→</span>;
  }
  return (
    <span className="flex items-center justify-center w-8 shrink-0" style={{ color: STATUS_COLOR[tone] }}>
      →
    </span>
  );
}

function ChainNode({
  label,
  value,
  sub,
  children,
}: {
  label: string;
  value?: string;
  sub?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex-none min-w-[180px] max-w-[240px] rounded-lg border bg-muted/30 p-3">
      <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
      {value && <div className="text-sm font-semibold">{value}</div>}
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      {children}
    </div>
  );
}

export interface ConciliacaoCartaoLedgerProps {
  filters: LedgerFilters;
}

export function ConciliacaoCartaoLedger({ filters }: ConciliacaoCartaoLedgerProps) {
  const { formatValue } = useHideValues();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [buscaManualFor, setBuscaManualFor] = useState<LedgerCartaoLancamento | null>(null);
  const [loteVinculando, setLoteVinculando] = useState<LedgerCartaoLote | null>(null);
  const [loteLancando, setLoteLancando] = useState<LedgerCartaoLote | null>(null);

  useEffect(() => {
    setSelected(new Set());
  }, [filters.integracaoId, filters.contaId, filters.periodoInicio, filters.periodoFim, filters.filialId]);

  const queryKey = [
    "ledger-conciliacao-cartao",
    filters.integracaoId,
    filters.contaId,
    filters.periodoInicio,
    filters.periodoFim,
    filters.filialId,
  ] as const;

  const {
    data: ledger,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () =>
      listarLedgerConciliacaoCartao({
        integracaoId: filters.integracaoId,
        contaId: filters.contaId,
        periodoInicio: filters.periodoInicio,
        periodoFim: filters.periodoFim,
        filialId: filters.filialId,
      }),
    enabled: filters.enabled && !!filters.integracaoId && !!filters.contaId,
  });

  // Full LoteAntecipacao (com extratos_bancarios embed via
  // fin_listar_extratos_vinculados_lote) — o ledger só devolve campos
  // escalares (credito_banco/data_liquidacao), insuficiente pros diálogos
  // de escrita (VincularExtratoLoteDialog/LancarDesagioDialog exigem
  // data_contratacao_contrato/extratos_bancarios.filial_id). Escopo do
  // ledger.lotes (período+conta) filtra QUAIS mostrar; os dados ricos vêm
  // daqui, casados por id.
  const { data: lotesFull = [], refetch: refetchLotesFull } = useLotesAntecipacao();
  const loteFullById = useMemo(() => new Map(lotesFull.map((l) => [l.id, l])), [lotesFull]);

  const lancamentos = ledger?.lancamentos ?? [];
  const lotes = ledger?.lotes ?? [];
  const resumo = ledger?.resumo ?? { fechados: 0, aguardando_banco: 0, sem_hop2: 0, divergencia: 0 };

  const lancamentoByGrupoId = useMemo(() => {
    const map = new Map<string, LedgerCartaoLancamento>();
    for (const l of lancamentos) map.set(l.grupo_id, l);
    return map;
  }, [lancamentos]);

  // Sugestões Hop 1 (venda ↔ banco sem antecipação) — repõe a ação que
  // Hop1VendaBancoSection oferecia antes de ser removida. 1 chamada pro
  // período inteiro (mesma disciplina da sugestão Hop 2 acima, nunca 1 por
  // linha), casada por data_vencimento_real+filial dentro do render.
  const { data: candidatosHop1 = [] } = useQuery({
    queryKey: [
      "candidatos-venda-banco-getnet",
      filters.contaId,
      filters.integracaoId,
      filters.periodoInicio,
      filters.periodoFim,
      filters.filialId,
    ],
    queryFn: () =>
      gerarCandidatosVendaBancoGetnet({
        contaId: filters.contaId,
        integracaoId: filters.integracaoId,
        periodoInicio: filters.periodoInicio,
        periodoFim: filters.periodoFim,
        filialId: filters.filialId,
      }),
    enabled: filters.enabled && !!filters.integracaoId && !!filters.contaId,
  });

  const candidatosHop1PorData = useMemo(() => {
    const map = new Map<string, CandidatoVendaBancoGetnet[]>();
    for (const c of candidatosHop1) {
      const arr = map.get(c.data_vencimento);
      if (arr) arr.push(c);
      else map.set(c.data_vencimento, [c]);
    }
    return map;
  }, [candidatosHop1]);

  const sugestoesHop1PorGrupo = useMemo(() => {
    const map = new Map<string, CandidatoVendaBancoGetnet>();
    for (const l of lancamentos) {
      if (l.status !== "aguardando_banco") continue;
      const candidato = encontrarCandidatoHop1(l, candidatosHop1PorData);
      if (candidato) map.set(l.grupo_id, candidato);
    }
    return map;
  }, [lancamentos, candidatosHop1PorData]);

  // Poda seleção stale após refetch (mesmo padrão de Hop2OfertaVendaSection
  // — Bugbot #82 — evita Confirmar habilitado sobre linha que sumiu/mudou).
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const key of prev) {
        const l = lancamentoByGrupoId.get(key);
        if (l && l.status === "sem_hop2" && l.sugestao) next.add(key);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [lancamentoByGrupoId]);

  const invalidateAfterVinculo = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["conferencia-totais-getnet"] });
  };

  const confirmarSugestoes = useMutation({
    mutationFn: async (grupoIds: string[]) => {
      let ok = 0;
      const erros: string[] = [];
      let stale = 0;
      for (const grupoId of grupoIds) {
        const l = lancamentoByGrupoId.get(grupoId);
        if (!l || l.status !== "sem_hop2" || !l.sugestao) {
          stale += 1;
          continue;
        }
        try {
          const res = await vincularVendaGetnetOferta(grupoId, l.sugestao.recebivel_ids);
          ok += 1;
          if (res.warnings?.length) toast.warning(res.warnings.join("; "));
        } catch (err) {
          erros.push(rpcErrorMessage(err) ?? "Erro ao vincular oferta ↔ venda");
        }
      }
      return { ok, erros, stale };
    },
    onSuccess: ({ ok, erros, stale }) => {
      if (ok > 0) {
        toast.success(ok === 1 ? "1 vínculo confirmado" : `${ok} vínculos confirmados`);
      }
      if (erros.length > 0) {
        toast.error(erros.length === 1 ? erros[0] : `${erros.length} falhas — primeira: ${erros[0]}`);
      }
      if (ok === 0 && erros.length === 0) {
        toast.error(
          stale > 0
            ? "Seleção desatualizada — atualize a lista e tente de novo"
            : "Nenhum vínculo confirmado",
        );
      }
      setSelected(new Set());
      invalidateAfterVinculo();
    },
    onError: (err) => {
      toast.error(rpcErrorMessage(err) ?? "Erro ao confirmar sugestão");
    },
  });

  const confirmarHop1 = useMutation({
    mutationFn: (candidato: CandidatoVendaBancoGetnet) =>
      vincularVendaBancoGetnet(candidato.extrato_id, candidato.recebivel_ids),
    onSuccess: (res) => {
      toast.success("Vínculo com o banco confirmado");
      if (res.warnings?.length) toast.warning(res.warnings.join("; "));
      invalidateAfterVinculo();
    },
    onError: (err) => {
      toast.error(rpcErrorMessage(err) ?? "Erro ao confirmar vínculo com o banco");
    },
  });

  const gruposPorData = useMemo(() => {
    const ordem: string[] = [];
    const map = new Map<string, LedgerCartaoLancamento[]>();
    for (const l of lancamentos) {
      const key = l.data_vencimento;
      if (!map.has(key)) {
        map.set(key, []);
        ordem.push(key);
      }
      map.get(key)!.push(l);
    }
    return ordem.map((data) => ({ data, itens: map.get(data)! }));
  }, [lancamentos]);

  const eligibleKeys = lancamentos.filter((l) => l.status === "sem_hop2" && l.sugestao).map((l) => l.grupo_id);
  const nSel = selected.size;

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const errorMsg = isError ? rpcErrorMessage(error) : null;

  return (
    <div className="space-y-4 pb-16">
      {!filters.integracaoId || !filters.contaId ? (
        <div className="border rounded-lg p-8 text-center text-sm text-muted-foreground">
          Selecione integração Getnet e conta bancária para carregar o ledger.
        </div>
      ) : isLoading || isFetching ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <div className="border rounded-lg p-8 text-center text-sm text-destructive">
          Não foi possível carregar o ledger{errorMsg ? `: ${errorMsg}` : "."}
        </div>
      ) : (
        <>
          {/* Tira de resumo — 4 células */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px rounded-lg border overflow-hidden bg-border">
            <SummaryCell label="Fechados" value={resumo.fechados} tone="good" />
            <SummaryCell label="Aguardando banco" value={resumo.aguardando_banco} tone="warning" />
            <SummaryCell label="Pendente vínculo" value={resumo.sem_hop2} tone="serious" />
            <SummaryCell label="Divergência" value={resumo.divergencia} tone="critical" />
          </div>

          {lancamentos.length === 0 && lotes.length === 0 ? (
            <div className="border rounded-lg p-12 text-center text-sm text-muted-foreground">
              Nenhum lançamento em cartão neste período.
            </div>
          ) : (
            <>
              {gruposPorData.map(({ data, itens }) => (
                <div key={data} className="space-y-2">
                  <SectionLabel>{formatDateSafe(data, "d 'de' MMMM")} — culto</SectionLabel>
                  <div className="space-y-2">
                    {itens.map((l) => (
                      <LancamentoRow
                        key={l.grupo_id}
                        lancamento={l}
                        open={expanded.has(l.grupo_id)}
                        onToggle={() => toggleExpanded(l.grupo_id)}
                        selected={selected.has(l.grupo_id)}
                        selectable={l.status === "sem_hop2" && !!l.sugestao}
                        onSelectChange={(checked) =>
                          setSelected((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(l.grupo_id);
                            else next.delete(l.grupo_id);
                            return next;
                          })
                        }
                        formatValue={formatValue}
                        onConfirmarSugestao={() => confirmarSugestoes.mutate([l.grupo_id])}
                        onBuscarManualmente={() => setBuscaManualFor(l)}
                        confirmando={confirmarSugestoes.isPending}
                        sugestaoHop1={sugestoesHop1PorGrupo.get(l.grupo_id) ?? null}
                        onConfirmarHop1={() => {
                          const candidato = sugestoesHop1PorGrupo.get(l.grupo_id);
                          if (candidato) confirmarHop1.mutate(candidato);
                        }}
                        confirmandoHop1={confirmarHop1.isPending}
                      />
                    ))}
                  </div>
                </div>
              ))}

              {lotes.length > 0 && (
                <div className="space-y-2">
                  <SectionLabel>Antecipação — lotes do período</SectionLabel>
                  <div className="space-y-2">
                    {lotes.map((lote) => (
                      <LoteRow
                        key={lote.lote_id}
                        lote={lote}
                        open={expanded.has(lote.lote_id)}
                        onToggle={() => toggleExpanded(lote.lote_id)}
                        formatValue={formatValue}
                        onVincularExtrato={() => setLoteVinculando(lote)}
                        onLancarSaida={() => setLoteLancando(lote)}
                        temDadosCompletos={loteFullById.has(lote.lote_id)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Barra de ação flutuante — só bulk-confirm de sem_hop2 com sugestão */}
      {nSel > 0 && (
        <div className="fixed left-1/2 bottom-5 -translate-x-1/2 z-20 flex items-center gap-4 rounded-xl bg-foreground text-background px-4 py-3 shadow-lg">
          <span className="text-sm">
            <strong>{nSel}</strong> selecionado{nSel === 1 ? "" : "s"}
          </span>
          <Button size="sm" variant="secondary" onClick={() => setSelected(new Set())}>
            Limpar
          </Button>
          <Button
            size="sm"
            onClick={() => confirmarSugestoes.mutate([...selected])}
            disabled={confirmarSugestoes.isPending}
          >
            {confirmarSugestoes.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            )}
            Confirmar sugestões
          </Button>
        </div>
      )}

      {eligibleKeys.length > 1 && (
        <p className="text-xs text-muted-foreground text-center">
          {eligibleKeys.length} lançamento{eligibleKeys.length === 1 ? "" : "s"} pendente
          {eligibleKeys.length === 1 ? "" : "s"} com sugestão — selecione pra confirmar em lote.
        </p>
      )}

      {buscaManualFor && (
        <BuscaManualDialog<CandidatoBuscaRecebivelOferta>
          open={!!buscaManualFor}
          onOpenChange={(open) => !open && setBuscaManualFor(null)}
          title="Buscar recebível manualmente"
          icon={<Search className="w-5 h-5 text-primary" />}
          anchorCard={
            <div className="p-3 rounded-lg border bg-muted/40">
              <p className="text-xs text-muted-foreground mb-1">Oferta a vincular:</p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{buscaManualFor.descricao}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateSafe(buscaManualFor.data_vencimento)}
                    {buscaManualFor.parcelado ? ` · parcelado ${buscaManualFor.total_parcelas}×` : ""}
                  </p>
                </div>
                <p className="font-bold text-sm">{formatValue(buscaManualFor.valor_bruto)}</p>
              </div>
            </div>
          }
          searchPlaceholder="Buscar por NSU, bandeira..."
          queryKey={["buscar-recebiveis-getnet-oferta", buscaManualFor.grupo_id, filters.integracaoId]}
          queryFn={(busca) =>
            buscarRecebiveisGetnetOferta({
              transacaoId: buscaManualFor.grupo_id,
              integracaoId: filters.integracaoId,
              busca,
              limite: 100,
            })
          }
          getId={(c) => c.recebivel_id}
          getGroupKey={(c) => c.nsu ?? c.recebivel_id}
          getScore={(c) => Number(c.score)}
          scoreThresholds={BUSCA_MANUAL_THRESHOLDS}
          renderItem={(c) => ({
            label: `NSU ${c.nsu ?? "—"}`,
            sublabel: c.bandeira_modalidade ?? undefined,
            dateStr: formatDateSafe(c.data_venda),
            value: Number(c.valor_venda),
          })}
          renderGroupHint={(items) => (
            <span className="text-xs text-muted-foreground">
              {items.length} parcela{items.length === 1 ? "" : "s"} encontrada
              {items.length === 1 ? "" : "s"} do NSU {items[0].nsu} — vínculo parcelado exige o
              conjunto completo, o servidor recusa se faltar parcela.
            </span>
          )}
          onConfirm={async (ids) => {
            const res = await vincularVendaGetnetOferta(buscaManualFor.grupo_id, ids);
            return {
              successMessage:
                ids.length > 1 ? `${ids.length} parcelas vinculadas à oferta` : "Recebível vinculado à oferta",
              warnings: res.warnings,
            };
          }}
          onConfirmed={invalidateAfterVinculo}
          confirmLabel="Vincular à oferta"
          emptyTitle="Nenhum recebível livre encontrado"
          emptyHint="Amplie a busca por NSU ou confirme se o CSV Getnet já foi importado"
        />
      )}

      {loteVinculando && loteFullById.get(loteVinculando.lote_id) && (
        <VincularExtratoLoteDialog
          open={!!loteVinculando}
          onOpenChange={(open) => !open && setLoteVinculando(null)}
          lote={loteFullById.get(loteVinculando.lote_id)!}
          onVinculado={() => {
            refetchLotesFull();
            invalidateAfterVinculo();
            setLoteVinculando(null);
          }}
        />
      )}

      {loteLancando && loteFullById.get(loteLancando.lote_id) && (
        <LancarDesagioDialog
          open={!!loteLancando}
          onOpenChange={(open) => !open && setLoteLancando(null)}
          lote={loteFullById.get(loteLancando.lote_id)!}
          onLancado={() => {
            refetchLotesFull();
            invalidateAfterVinculo();
            setLoteLancando(null);
          }}
        />
      )}
    </div>
  );
}

function SummaryCell({ label, value, tone }: { label: string; value: number; tone: StatusTone }) {
  const Icon = STATUS_ICON[tone];
  return (
    <div className="bg-card p-4">
      <span className="flex items-center gap-1.5 text-2xl font-semibold" style={{ color: STATUS_COLOR[tone] }}>
        <Icon className="w-4 h-4" />
        {value}
      </span>
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground mt-6">
      <span>{children}</span>
      <span className="flex-1 h-px bg-border" />
    </div>
  );
}

function LancamentoRow({
  lancamento: l,
  open,
  onToggle,
  selected,
  selectable,
  onSelectChange,
  formatValue,
  onConfirmarSugestao,
  onBuscarManualmente,
  confirmando,
  sugestaoHop1,
  onConfirmarHop1,
  confirmandoHop1,
}: {
  lancamento: LedgerCartaoLancamento;
  open: boolean;
  onToggle: () => void;
  selected: boolean;
  selectable: boolean;
  onSelectChange: (checked: boolean) => void;
  formatValue: (v: number) => string;
  onConfirmarSugestao: () => void;
  onBuscarManualmente: () => void;
  confirmando: boolean;
  sugestaoHop1: CandidatoVendaBancoGetnet | null;
  onConfirmarHop1: () => void;
  confirmandoHop1: boolean;
}) {
  const pill = statusPill(l);
  const batidas = nBatidas(l);

  return (
    <Collapsible open={open} onOpenChange={onToggle} className="border rounded-lg bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {selectable ? (
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelectChange(v === true)}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Selecionar lançamento ${l.descricao}`}
          />
        ) : (
          <span className="w-4" />
        )}
        <CollapsibleTrigger asChild>
          <button type="button" className="flex-1 flex items-center gap-3 min-w-0 text-left">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{l.descricao}</p>
              <p className="text-xs text-muted-foreground font-mono">
                venc. {formatDateSafe(l.data_vencimento, "dd/MM")}
                {l.parcelado ? ` · parcelado ${l.total_parcelas}×` : ""}
              </p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">{formatValue(l.valor_bruto)}</span>
            <StatusPillBadge tone={pill.tone} label={pill.label} />
            <span className={`text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="border-t px-4 py-4 space-y-3">
          <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
            <ChainNode label="Oferta (bruto)" value={formatValue(l.valor_bruto)} sub={formatDateSafe(l.data_vencimento)} />
            {l.status === "sem_hop2" ? (
              l.sugestao ? (
                <>
                  <ChainLink />
                  <ChainNode label="Sugestão" value={formatValue(l.valor_bruto)}>
                    <div className="mt-1 flex items-center gap-2">
                      <ScoreBadge score={l.sugestao.score} thresholds={SUGESTAO_HOP_THRESHOLDS} />
                      <span className="text-xs text-muted-foreground">
                        {l.sugestao.recebivel_ids.length} recebível
                        {l.sugestao.recebivel_ids.length === 1 ? "" : "is"}
                      </span>
                    </div>
                  </ChainNode>
                </>
              ) : (
                <>
                  <ChainLink />
                  <ChainNode label="Sugestão" value="—" sub="Nenhuma sugestão automática — busque manualmente" />
                </>
              )
            ) : l.parcelado ? (
              <>
                <ChainLink tone="good" />
                <div className="flex-none min-w-[220px] max-w-[280px] rounded-lg border bg-muted/30 p-3">
                  <div className="text-[0.7rem] uppercase tracking-wide text-muted-foreground mb-2">
                    Venda Getnet — {l.total_parcelas} parcelas
                  </div>
                  <div className="space-y-1.5">
                    {l.parcelas.map((p) => (
                      <div
                        key={`${p.numero_parcela}-${p.nsu ?? p.numero_parcela}`}
                        className="flex items-center justify-between gap-2 text-xs border-t pt-1.5 first:border-t-0 first:pt-0"
                      >
                        <span className="text-muted-foreground font-mono flex items-center gap-1">
                          {p.numero_parcela}/{p.total_parcelas}
                          {p.hop1_status === "antecipada" && (
                            <span className="inline-flex items-center gap-0.5 text-amber-600">
                              <Zap className="w-3 h-3" /> antecipada
                            </span>
                          )}
                        </span>
                        <span className="font-medium whitespace-nowrap">
                          {formatValue(p.valor_liquido ?? 0)}
                          {(p.hop1_status === "fechado" || p.hop1_status === "antecipada") && " ✓"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <ChainLink tone="good" />
                <ChainNode
                  label="Venda Getnet"
                  value={formatValue(l.parcelas[0]?.valor_liquido ?? l.valor_bruto)}
                  sub={l.parcelas[0]?.nsu ? `NSU ${l.parcelas[0].nsu}` : undefined}
                />
              </>
            )}
            {l.status !== "sem_hop2" && (
              <>
                <ChainLink tone={l.status === "fechado" ? "good" : l.status === "divergencia" ? "critical" : "pending"} />
                <ChainNode
                  label="Crédito no banco"
                  value={`${batidas} de ${l.total_parcelas} batidas`}
                  sub={
                    l.status === "divergencia"
                      ? "Soma dos recebíveis diverge do extrato vinculado"
                      : l.status === "fechado"
                        ? "Confirmado"
                        : undefined
                  }
                >
                  {l.status === "aguardando_banco" && sugestaoHop1 && (
                    <div className="mt-1 flex items-center gap-2">
                      <ScoreBadge score={sugestaoHop1.score} thresholds={SUGESTAO_HOP_THRESHOLDS} />
                      <span className="text-xs text-muted-foreground">sugestão de crédito</span>
                    </div>
                  )}
                </ChainNode>
              </>
            )}
          </div>

          {l.status === "sem_hop2" && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" disabled={!l.sugestao || confirmando} onClick={onConfirmarSugestao}>
                {confirmando ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                )}
                Confirmar sugestão
              </Button>
              <Button size="sm" variant="outline" onClick={onBuscarManualmente}>
                <Search className="w-3.5 h-3.5 mr-1" /> Buscar manualmente
              </Button>
            </div>
          )}

          {l.status === "aguardando_banco" && sugestaoHop1 && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" disabled={confirmandoHop1} onClick={onConfirmarHop1}>
                {confirmandoHop1 ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                )}
                Confirmar sugestão
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function LoteRow({
  lote,
  open,
  onToggle,
  formatValue,
  onVincularExtrato,
  onLancarSaida,
  temDadosCompletos,
}: {
  lote: LedgerCartaoLote;
  open: boolean;
  onToggle: () => void;
  formatValue: (v: number) => string;
  onVincularExtrato: () => void;
  onLancarSaida: () => void;
  temDadosCompletos: boolean;
}) {
  const meta = LOTE_STATUS_META[lote.status];
  const desagioCalc =
    lote.desagio != null ? lote.desagio : lote.valor_contrato != null && lote.credito_banco != null
      ? lote.valor_contrato - lote.credito_banco
      : null;

  return (
    <Collapsible open={open} onOpenChange={onToggle} className="border rounded-lg bg-card shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <CollapsibleTrigger asChild>
          <button type="button" className="flex-1 flex items-center gap-3 min-w-0 text-left">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">Lote antecipado — contrato {lote.contrato_registradora}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {lote.vendas_origem.length} venda{lote.vendas_origem.length === 1 ? "" : "s"} agrupada
                {lote.vendas_origem.length === 1 ? "" : "s"}
                {lote.data_liquidacao ? ` · liquidado ${formatDateSafe(lote.data_liquidacao)}` : ""}
              </p>
            </div>
            <span className="text-sm font-semibold whitespace-nowrap">
              {formatValue(lote.valor_contrato ?? 0)}
            </span>
            <StatusPillBadge tone={meta.tone} label={meta.label} />
            <span className={`text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div className="border-t px-4 py-4 space-y-4">
          <div className="flex items-stretch gap-0 overflow-x-auto pb-1">
            <ChainNode label="Valor do contrato" value={formatValue(lote.valor_contrato ?? 0)} />
            <ChainLink tone={desagioCalc != null ? "good" : "pending"} />
            <ChainNode
              label="Deságio lançado"
              value={desagioCalc != null ? formatValue(desagioCalc) : "—"}
              sub="saída · antecipação Getnet"
            />
            <ChainLink tone={lote.credito_banco != null ? "good" : "pending"} />
            <ChainNode
              label="Crédito no banco"
              value={lote.credito_banco != null ? formatValue(lote.credito_banco) : "—"}
              sub={lote.data_liquidacao ? formatDateSafe(lote.data_liquidacao) : undefined}
            />
          </div>

          {lote.vendas_origem.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-2">Vendas dentro deste lote</p>
              <div className="rounded-lg border divide-y">
                {lote.vendas_origem.map((v, i) => (
                  <div key={`${v.nsu ?? i}-${i}`} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <span className="font-mono text-muted-foreground">
                      NSU {v.nsu ?? "—"} · {formatValue(v.valor_parcela_liquido ?? 0)}
                    </span>
                    <span className="text-right">
                      {v.oferta_lancamento_id ? (
                        <span className="text-foreground">
                          parcela {v.numero_parcela}/{v.total_parcelas} de{" "}
                          <span className="font-medium">
                            {v.oferta_descricao ?? "oferta"}
                            {v.oferta_data_vencimento ? ` · ${formatDateSafe(v.oferta_data_vencimento, "dd/MM")}` : ""}
                          </span>
                        </span>
                      ) : (
                        <span className="italic text-muted-foreground">
                          venda ainda sem oferta vinculada — Hop 2 pendente
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2 max-w-[60ch]">
                O deságio é lançado uma vez, pelo lote inteiro — não é rateado de volta pra cada oferta.
              </p>
            </div>
          )}

          <div className="flex gap-2">
            {lote.status === "pendente_vinculo" && (
              <Button size="sm" variant="outline" onClick={onVincularExtrato} disabled={!temDadosCompletos}>
                <Link2 className="w-3.5 h-3.5 mr-1" /> Vincular extrato
              </Button>
            )}
            {lote.status === "vinculado" && (
              <>
                <Button size="sm" variant="outline" onClick={onVincularExtrato} disabled={!temDadosCompletos}>
                  <Link2 className="w-3.5 h-3.5 mr-1" /> Corrigir vínculo
                </Button>
                <Button size="sm" variant="destructive" onClick={onLancarSaida} disabled={!temDadosCompletos}>
                  <TrendingDown className="w-3.5 h-3.5 mr-1" /> Lançar como saída
                </Button>
              </>
            )}
            {lote.status === "lancamento_criado" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Landmark className="w-3.5 h-3.5" /> Concluído
              </span>
            )}
            {!temDadosCompletos && lote.status !== "lancamento_criado" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> Carregando dados do lote…
              </span>
            )}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
