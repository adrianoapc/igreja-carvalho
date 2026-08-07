import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Search, Link2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useHideValues } from "@/hooks/useHideValues";
import { ScoreBadge, rpcErrorMessage, type ScoreThresholds } from "@/components/financas/ScoreBadge";

/**
 * Diálogo de busca manual compartilhado — generaliza o padrão hoje duplicado
 * entre `VincularExtratoLoteDialog` e `VincularTransacaoDialog`
 * (`ResponsiveDialog` + `Input` de busca + `RadioGroup` + `ScoreBadge`),
 * parametrizado por `queryFn` (busca) e `onConfirm` (vínculo).
 *
 * Seleção é por GRUPO, não por item: quando `getGroupKey` produz mais de 1
 * item pro mesmo grupo (ex.: parcelas do mesmo NSU numa venda parcelada), o
 * clique seleciona o grupo inteiro de uma vez — é o que o ledger Getnet
 * precisa (Fase 7b) pra "buscar manualmente" respeitar o conjunto 1..N
 * completo que o writer exige. Call-sites de item único (padrão histórico
 * dos outros 2 diálogos) usam `getGroupKey` default = `getId`, então cada
 * grupo tem 1 item só e o comportamento visual não muda.
 */

export interface BuscaManualRenderedItem {
  label: ReactNode;
  sublabel?: ReactNode;
  dateStr?: ReactNode;
  value: number;
  valueClassName?: string;
}

export interface BuscaManualDialogProps<T> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  icon?: ReactNode;
  /** Card de destaque no topo — o que está sendo vinculado (lote/extrato/oferta). */
  anchorCard: ReactNode;
  /** Badge opcional acima da busca (ex.: janela de datas considerada). */
  contextBadge?: ReactNode;
  searchPlaceholder: string;
  queryKey: unknown[];
  queryFn: (busca: string | null) => Promise<T[]>;
  getId: (item: T) => string;
  /** Default: agrupa por `getId` (1 item por grupo — comportamento histórico). */
  getGroupKey?: (item: T) => string;
  getScore: (item: T) => number;
  scoreThresholds: ScoreThresholds;
  renderItem: (item: T) => BuscaManualRenderedItem;
  /** Dica extra dentro de um grupo com >1 item (ex.: "3 parcelas do NSU X"). */
  renderGroupHint?: (items: T[]) => ReactNode;
  onConfirm: (ids: string[], items: T[]) => Promise<{ successMessage: string; warnings?: string[] }>;
  onConfirmed?: () => void;
  confirmLabel?: string;
  emptyTitle?: string;
  emptyHint?: string;
}

export function BuscaManualDialog<T>({
  open,
  onOpenChange,
  title,
  icon,
  anchorCard,
  contextBadge,
  searchPlaceholder,
  queryKey,
  queryFn,
  getId,
  getGroupKey,
  getScore,
  scoreThresholds,
  renderItem,
  renderGroupHint,
  onConfirm,
  onConfirmed,
  confirmLabel = "Confirmar vínculo",
  emptyTitle = "Nenhum candidato encontrado",
  emptyHint = "Amplie a busca ou confirme se o dado já foi importado",
}: BuscaManualDialogProps<T>) {
  const { formatValue } = useHideValues();
  const [loading, setLoading] = useState(false);
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");

  // Debounce de 300ms — sem isso, cada tecla digitada refaz queryFn (RPC ou
  // query direta ao Supabase, dependendo do call-site), gerando 1 round-trip
  // de rede por caractere. Input continua respondendo na hora (searchTerm),
  // só a busca em si atrasa.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const buscaRpc = debouncedSearchTerm.trim() || null;
  const { data: itens = [], isLoading, isFetching } = useQuery({
    queryKey: [...queryKey, buscaRpc],
    queryFn: () => queryFn(buscaRpc),
    enabled: open,
  });

  const groups = useMemo(() => {
    const map = new Map<string, T[]>();
    for (const item of itens) {
      const key = getGroupKey ? getGroupKey(item) : getId(item);
      const arr = map.get(key);
      if (arr) arr.push(item);
      else map.set(key, [item]);
    }
    return [...map.entries()]
      .map(([key, items]) => ({
        key,
        items,
        score: Math.max(...items.map(getScore)),
      }))
      .sort((a, b) => b.score - a.score);
  }, [itens, getGroupKey, getId, getScore]);

  const selectedGroup = groups.find((g) => g.key === selectedGroupKey) ?? null;

  const handleConfirmar = async () => {
    if (!selectedGroup) {
      toast.error("Selecione uma opção para vincular");
      return;
    }
    setLoading(true);
    try {
      const ids = selectedGroup.items.map(getId);
      const res = await onConfirm(ids, selectedGroup.items);
      toast.success(res.successMessage);
      if (res.warnings?.length) {
        toast.warning(res.warnings.join("; "));
      }
      onConfirmed?.();
      onOpenChange(false);
      setSelectedGroupKey(null);
      setSearchTerm("");
    } catch (err) {
      console.error(err);
      toast.error(rpcErrorMessage(err) ?? "Erro ao confirmar vínculo");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setSelectedGroupKey(null);
          setSearchTerm("");
        }
        onOpenChange(next);
      }}
      trigger={null}
      dialogContentProps={{ className: "max-w-xl max-h-[85vh] overflow-hidden flex flex-col" }}
    >
      <div className="space-y-4 flex flex-col min-h-0 overflow-hidden">
        <div className="flex items-center gap-2">
          {icon ?? <Link2 className="w-5 h-5 text-primary" />}
          <h2 className="text-lg font-semibold">{title}</h2>
        </div>

        {anchorCard}

        {contextBadge}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="flex-1 min-h-0 max-h-[280px] border rounded-lg">
          {isLoading || isFetching ? (
            <div className="flex items-center justify-center h-full p-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length > 0 ? (
            <RadioGroup
              value={selectedGroupKey || ""}
              onValueChange={setSelectedGroupKey}
              className="p-2 space-y-2"
            >
              {groups.map((group) => {
                const primary = renderItem(group.items[0]);
                const isMulti = group.items.length > 1;
                return (
                  <div
                    key={group.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedGroupKey === group.key
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                    onClick={() => setSelectedGroupKey(group.key)}
                  >
                    <RadioGroupItem value={group.key} id={group.key} className="mt-1" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1 flex-wrap">
                        <Label htmlFor={group.key} className="font-medium text-sm cursor-pointer break-words">
                          {primary.label}
                        </Label>
                        <ScoreBadge score={group.score} thresholds={scoreThresholds} />
                      </div>
                      {primary.dateStr && (
                        <span className="text-xs text-muted-foreground">{primary.dateStr}</span>
                      )}
                      {primary.sublabel && (
                        <div className="text-xs text-muted-foreground">{primary.sublabel}</div>
                      )}
                      {isMulti && (
                        <div className="mt-2 space-y-1 border-t pt-2">
                          {renderGroupHint ? (
                            renderGroupHint(group.items)
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {group.items.length} linhas agrupadas
                            </span>
                          )}
                          {group.items.map((item) => {
                            const rendered = renderItem(item);
                            return (
                              <div
                                key={getId(item)}
                                className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
                              >
                                <span className="truncate">{rendered.sublabel ?? rendered.label}</span>
                                <span className={`font-medium whitespace-nowrap ${rendered.valueClassName ?? ""}`}>
                                  {formatValue(rendered.value)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    {!isMulti && (
                      <p
                        className={`font-bold text-sm whitespace-nowrap shrink-0 text-green-600 ${
                          primary.valueClassName ?? ""
                        }`}
                      >
                        {formatValue(primary.value)}
                      </p>
                    )}
                  </div>
                );
              })}
            </RadioGroup>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
              <AlertCircle className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">{emptyTitle}</p>
              <p className="text-xs text-muted-foreground mt-1">{emptyHint}</p>
            </div>
          )}
        </ScrollArea>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirmar} disabled={loading || !selectedGroup}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
