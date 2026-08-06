import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertCircle, CheckCircle2, CreditCard, Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useHideValues } from "@/hooks/useHideValues";
import {
  gerarCandidatosOfertaVendaGetnet,
  gerarCandidatosVendaBancoGetnet,
  vincularVendaBancoGetnet,
  vincularVendaGetnetOferta,
  type CandidatoOfertaVendaGetnet,
  type CandidatoVendaBancoGetnet,
} from "@/features/financeiro/core/api/getnetRecebivel.api";

function scorePct(score: number): number {
  // Hop 1/2 devolvem 0..1; tolerância se algum dia vier 0..100.
  const pct = score > 1 ? score : score * 100;
  return Math.round(pct);
}

function ScoreBadge({ score }: { score: number }) {
  const pct = scorePct(score);
  if (pct >= 85) {
    return <Badge className="bg-green-500 text-white">Alta ({pct}%)</Badge>;
  }
  if (pct >= 50) {
    return <Badge className="bg-yellow-500 text-white">Média ({pct}%)</Badge>;
  }
  return <Badge variant="secondary">Baixa ({pct}%)</Badge>;
}

function formatDateSafe(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return format(parseISO(iso), "dd/MM/yyyy", { locale: ptBR });
  } catch {
    return iso;
  }
}

function hop2Key(c: CandidatoOfertaVendaGetnet): string {
  return `h2:${c.transacao_id}:${[...c.recebivel_ids].sort().join(",")}`;
}

function hop1Key(c: CandidatoVendaBancoGetnet): string {
  return `h1:${c.extrato_id}:${[...c.recebivel_ids].sort().join(",")}`;
}

function toggleKey(set: Set<string>, key: string, checked: boolean): Set<string> {
  const next = new Set(set);
  if (checked) next.add(key);
  else next.delete(key);
  return next;
}

interface SharedFilters {
  integracaoId: string;
  contaId: string;
  periodoInicio: string;
  periodoFim: string;
  filialId: string | null;
  enabled: boolean;
}

export function Hop2OfertaVendaSection({ filters }: { filters: SharedFilters }) {
  const { formatValue } = useHideValues();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [
    filters.integracaoId,
    filters.periodoInicio,
    filters.periodoFim,
    filters.filialId,
  ]);

  const queryKey = [
    "candidatos-oferta-venda-getnet",
    filters.integracaoId,
    filters.periodoInicio,
    filters.periodoFim,
    filters.filialId,
  ] as const;

  const {
    data: candidatos = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: () =>
      gerarCandidatosOfertaVendaGetnet({
        integracaoId: filters.integracaoId,
        periodoInicio: filters.periodoInicio,
        periodoFim: filters.periodoFim,
        filialId: filters.filialId,
      }),
    enabled: filters.enabled && !!filters.integracaoId,
  });

  const byKey = useMemo(() => {
    const map = new Map<string, CandidatoOfertaVendaGetnet>();
    for (const c of candidatos) map.set(hop2Key(c), c);
    return map;
  }, [candidatos]);

  // Refetch pode esvaziar/alterar a lista — poda keys stale pra o botão
  // Confirmar não ficar habilitado sem candidatos reais (Bugbot #82).
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const k of prev) {
        if (byKey.has(k)) next.add(k);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [byKey]);

  const confirmar = useMutation({
    mutationFn: async (keys: string[]) => {
      let ok = 0;
      const erros: string[] = [];
      let stale = 0;
      for (const key of keys) {
        const c = byKey.get(key);
        if (!c) {
          stale += 1;
          continue;
        }
        try {
          const res = await vincularVendaGetnetOferta(c.transacao_id, c.recebivel_ids);
          ok += 1;
          if (res.warnings?.length) {
            toast.warning(res.warnings.join("; "));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro ao vincular oferta ↔ venda";
          erros.push(msg);
        }
      }
      return { ok, erros, stale };
    },
    onSuccess: ({ ok, erros, stale }) => {
      if (ok > 0) {
        toast.success(
          ok === 1 ? "1 vínculo Hop 2 confirmado" : `${ok} vínculos Hop 2 confirmados`,
        );
      }
      if (erros.length > 0) {
        toast.error(
          erros.length === 1
            ? erros[0]
            : `${erros.length} falhas — primeira: ${erros[0]}`,
        );
      }
      if (ok === 0 && erros.length === 0) {
        toast.error(
          stale > 0
            ? "Seleção desatualizada — atualize a lista e tente de novo"
            : "Nenhum vínculo confirmado",
        );
      }
      setSelected(new Set());
      refetch();
      queryClient.invalidateQueries({ queryKey: ["conferencia-totais-getnet"] });
      queryClient.invalidateQueries({ queryKey: ["candidatos-venda-banco-getnet"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao confirmar Hop 2");
    },
  });

  const allKeys = candidatos.map(hop2Key);
  const selectedValid = useMemo(
    () => [...selected].filter((k) => byKey.has(k)),
    [selected, byKey],
  );
  const nSel = selectedValid.length;
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  if (!filters.integracaoId) {
    return (
      <SectionShell
        title="Hop 2 — Oferta ↔ Venda Getnet"
        icon={<CreditCard className="w-4 h-4" />}
      >
        <p className="text-sm text-muted-foreground px-3 py-4">
          Selecione a integração Getnet para listar sugestões.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      title="Hop 2 — Oferta ↔ Venda Getnet"
      icon={<CreditCard className="w-4 h-4" />}
      count={isError ? undefined : candidatos.length}
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={candidatos.length === 0 || confirmar.isPending || isError}
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(allKeys))
            }
          >
            {allSelected ? "Limpar seleção" : "Selecionar todos"}
          </Button>
          <Button
            size="sm"
            disabled={nSel === 0 || confirmar.isPending || isError}
            onClick={() => confirmar.mutate(selectedValid)}
          >
            {confirmar.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            )}
            Confirmar {nSel > 0 ? nSel : ""} selecionado{nSel === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      {isLoading || isFetching ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive px-3 py-4">
          Não foi possível carregar sugestões
          {error instanceof Error && error.message ? `: ${error.message}` : "."}
        </p>
      ) : candidatos.length === 0 ? (
        <p className="text-sm text-muted-foreground px-3 py-4">
          Nenhuma sugestão pendente de Oferta ↔ Venda neste período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 w-10" />
                <th className="px-3 py-2 text-left">Data venda</th>
                <th className="px-3 py-2 text-left">Direção</th>
                <th className="px-3 py-2 text-right">Bruto Getnet</th>
                <th className="px-3 py-2 text-right">Oferta</th>
                <th className="px-3 py-2 text-left">NSUs</th>
                <th className="px-3 py-2 text-left">Score</th>
              </tr>
            </thead>
            <tbody>
              {candidatos.map((c) => {
                const key = hop2Key(c);
                const valorOferta = Number(c.features?.valor_oferta ?? c.valor_bruto);
                const nNsus = Number(c.features?.n_nsus ?? c.nsus?.length ?? 0);
                return (
                  <tr key={key} className="border-t">
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selected.has(key)}
                        onCheckedChange={(v) =>
                          setSelected((prev) => toggleKey(prev, key, v === true))
                        }
                        aria-label={`Selecionar sugestão Hop 2 ${formatDateSafe(c.data_venda)}`}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateSafe(c.data_venda)}
                    </td>
                    <td className="px-3 py-2 capitalize">{c.direcao}</td>
                    <td className="px-3 py-2 text-right">{formatValue(c.valor_bruto)}</td>
                    <td className="px-3 py-2 text-right">{formatValue(valorOferta)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {nNsus} NSU{nNsus === 1 ? "" : "s"} · {c.recebivel_ids.length} linha
                      {c.recebivel_ids.length === 1 ? "" : "s"}
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBadge score={c.score} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}

export function Hop1VendaBancoSection({ filters }: { filters: SharedFilters }) {
  const { formatValue } = useHideValues();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    setSelected(new Set());
  }, [
    filters.contaId,
    filters.integracaoId,
    filters.periodoInicio,
    filters.periodoFim,
    filters.filialId,
  ]);

  const queryKey = [
    "candidatos-venda-banco-getnet",
    filters.contaId,
    filters.integracaoId,
    filters.periodoInicio,
    filters.periodoFim,
    filters.filialId,
  ] as const;

  const {
    data: candidatos = [],
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey,
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

  const byKey = useMemo(() => {
    const map = new Map<string, CandidatoVendaBancoGetnet>();
    for (const c of candidatos) map.set(hop1Key(c), c);
    return map;
  }, [candidatos]);

  // Refetch pode esvaziar/alterar a lista — poda keys stale pra o botão
  // Confirmar não ficar habilitado sem candidatos reais (Bugbot #82).
  useEffect(() => {
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const k of prev) {
        if (byKey.has(k)) next.add(k);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [byKey]);

  const confirmar = useMutation({
    mutationFn: async (keys: string[]) => {
      let ok = 0;
      const erros: string[] = [];
      let stale = 0;
      for (const key of keys) {
        const c = byKey.get(key);
        if (!c) {
          stale += 1;
          continue;
        }
        try {
          const res = await vincularVendaBancoGetnet(c.extrato_id, c.recebivel_ids);
          ok += 1;
          if (res.warnings?.length) {
            toast.warning(res.warnings.join("; "));
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Erro ao vincular venda ↔ banco";
          erros.push(msg);
        }
      }
      return { ok, erros, stale };
    },
    onSuccess: ({ ok, erros, stale }) => {
      if (ok > 0) {
        toast.success(
          ok === 1 ? "1 vínculo Hop 1 confirmado" : `${ok} vínculos Hop 1 confirmados`,
        );
      }
      if (erros.length > 0) {
        toast.error(
          erros.length === 1
            ? erros[0]
            : `${erros.length} falhas — primeira: ${erros[0]}`,
        );
      }
      if (ok === 0 && erros.length === 0) {
        toast.error(
          stale > 0
            ? "Seleção desatualizada — atualize a lista e tente de novo"
            : "Nenhum vínculo confirmado",
        );
      }
      setSelected(new Set());
      refetch();
      queryClient.invalidateQueries({ queryKey: ["conferencia-totais-getnet"] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Erro ao confirmar Hop 1");
    },
  });

  const allKeys = candidatos.map(hop1Key);
  const selectedValid = useMemo(
    () => [...selected].filter((k) => byKey.has(k)),
    [selected, byKey],
  );
  const nSel = selectedValid.length;
  const allSelected = allKeys.length > 0 && allKeys.every((k) => selected.has(k));

  if (!filters.integracaoId || !filters.contaId) {
    return (
      <SectionShell
        title="Hop 1 — Venda ↔ Banco (sem antecipação)"
        icon={<Landmark className="w-4 h-4" />}
      >
        <p className="text-sm text-muted-foreground px-3 py-4">
          Selecione integração Getnet e conta bancária para listar sugestões.
        </p>
      </SectionShell>
    );
  }

  return (
    <SectionShell
      title="Hop 1 — Venda ↔ Banco (sem antecipação)"
      icon={<Landmark className="w-4 h-4" />}
      count={isError ? undefined : candidatos.length}
      actions={
        <>
          <Button
            size="sm"
            variant="outline"
            disabled={candidatos.length === 0 || confirmar.isPending || isError}
            onClick={() =>
              setSelected(allSelected ? new Set() : new Set(allKeys))
            }
          >
            {allSelected ? "Limpar seleção" : "Selecionar todos"}
          </Button>
          <Button
            size="sm"
            disabled={nSel === 0 || confirmar.isPending || isError}
            onClick={() => confirmar.mutate(selectedValid)}
          >
            {confirmar.isPending ? (
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
            )}
            Confirmar {nSel > 0 ? nSel : ""} selecionado{nSel === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      {isLoading || isFetching ? (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive px-3 py-4">
          Não foi possível carregar sugestões
          {error instanceof Error && error.message ? `: ${error.message}` : "."}
        </p>
      ) : candidatos.length === 0 ? (
        <p className="text-sm text-muted-foreground px-3 py-4">
          Nenhuma sugestão pendente de Venda ↔ Banco neste período.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/60">
              <tr>
                <th className="px-3 py-2 w-10" />
                <th className="px-3 py-2 text-left">Vencimento</th>
                <th className="px-3 py-2 text-right">Líquido Getnet</th>
                <th className="px-3 py-2 text-right">Crédito banco</th>
                <th className="px-3 py-2 text-left">Descrição</th>
                <th className="px-3 py-2 text-left">Score</th>
              </tr>
            </thead>
            <tbody>
              {candidatos.map((c) => {
                const key = hop1Key(c);
                const valorExtrato = Number(c.features?.valor_extrato ?? c.valor_liquido);
                const descricao = String(c.features?.descricao ?? "—");
                const discrepancia = Boolean(c.features?.discrepancia);
                return (
                  <tr key={key} className="border-t">
                    <td className="px-3 py-2">
                      <Checkbox
                        checked={selected.has(key)}
                        onCheckedChange={(v) =>
                          setSelected((prev) => toggleKey(prev, key, v === true))
                        }
                        aria-label={`Selecionar sugestão Hop 1 ${formatDateSafe(c.data_vencimento)}`}
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {formatDateSafe(c.data_vencimento)}
                    </td>
                    <td className="px-3 py-2 text-right">{formatValue(c.valor_liquido)}</td>
                    <td className="px-3 py-2 text-right">
                      <span className={discrepancia ? "text-amber-600 font-medium" : undefined}>
                        {formatValue(valorExtrato)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-[240px] truncate">
                      {descricao}
                      {discrepancia && (
                        <span className="ml-1 text-amber-600">· Δ valor</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <ScoreBadge score={c.score} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </SectionShell>
  );
}

function SectionShell({
  title,
  icon,
  count,
  actions,
  children,
}: {
  title: string;
  icon: ReactNode;
  count?: number;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border rounded-lg overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-3 py-2.5 bg-muted/40 border-b">
        <div className="flex items-center gap-2 font-medium text-sm">
          {icon}
          <span>{title}</span>
          {typeof count === "number" && (
            <Badge variant="secondary" className="font-normal">
              {count}
            </Badge>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

export function ConciliacaoCartaoIntro() {
  return (
    <Alert>
      <AlertCircle className="h-4 w-4" />
      <AlertDescription className="text-xs">
        Conciliação Cartão Getnet — confirme sugestões Hop 2 (oferta ↔ venda) e
        Hop 1 (venda ↔ banco sem antecipação), e trate lotes de antecipação
        abaixo. Nada é vinculado automaticamente: a escolha continua do
        tesoureiro.
      </AlertDescription>
    </Alert>
  );
}
