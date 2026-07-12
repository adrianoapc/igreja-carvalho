import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { useHideValues } from "@/hooks/useHideValues";
import { useGerarSuggestoesConciliacao } from "@/hooks/useGerarSuggestoesConciliacao";
import { useSuggestoesMLMapeadas } from "@/hooks/useSuggestoesMLMapeadas";
import {
  confirmarConciliacao as confirmarConciliacaoRpc,
  type VinculoConciliacao,
} from "@/features/financeiro/core";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MonthPicker } from "./MonthPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  parseLocalDate,
  formatLocalDate,
  startOfMonthLocal,
  endOfMonthLocal,
} from "@/utils/dateUtils";
import { cn } from "@/lib/utils";
import {
  Plus,
  Loader2,
  Search,
  Eye,
  EyeOff,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Settings,
  CheckCircle2,
} from "lucide-react";
import { gerarCandidatosConciliacao } from "@/features/financeiro/core/api/conciliacao.api";
import { QuickCreateTransacaoDialog } from "./QuickCreateTransacaoDialog";
import { TransacaoDetalheDrawer } from "./TransacaoDetalheDrawer";
import { ExtratoSugestaoMLA } from "./ExtratoSugestaoMLA";
import { toast } from "sonner";
import { anonymizePixDescription } from "@/utils/anonymization";

interface ExtratoItem {
  id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  conta_id: string;
}

interface TransacaoItem {
  id: string;
  data_pagamento: string;
  data_vencimento?: string;
  descricao: string;
  valor: number;
  valor_liquido?: number;
  taxas_administrativas?: number;
  juros?: number;
  multas?: number;
  desconto?: number;
  tipo: string;
  conta_id: string;
  transferencia_id?: string | null;
  status?: string;
  conciliacao_status?: string;
}

interface Conta {
  id: string;
  nome: string;
}

export function ConciliacaoInteligente() {
  const { formatValue, hideValues, toggleHideValues } = useHideValues();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const queryClient = useQueryClient();
  const { gerarSugestoes, isPending: gerando } =
    useGerarSuggestoesConciliacao();

  const [selectedExtratos, setSelectedExtratos] = useState<string[]>([]);
  const [selectedTransacoes, setSelectedTransacoes] = useState<string[]>([]);
  const [quickCreateDialogOpen, setQuickCreateDialogOpen] = useState(false);
  const [extratoParaQuickCreate, setExtratoParaQuickCreate] =
    useState<ExtratoItem | null>(null);
  const [transacaoDetalheOpen, setTransacaoDetalheOpen] = useState(false);
  const [transacaoSelecionada, setTransacaoSelecionada] =
    useState<TransacaoItem | null>(null);

  // Filtros gerais
  const [contaFiltro, setContaFiltro] = useState<string>("all");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [searchExtrato, setSearchExtrato] = useState("");

  // Month pickers independentes
  const [mesExtratos, setMesExtratos] = useState(new Date());
  const [mesTransacoes, setMesTransacoes] = useState(new Date());
  const [extratosCustomRange, setExtratosCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);
  const [transacoesCustomRange, setTransacoesCustomRange] = useState<{
    from: Date;
    to: Date;
  } | null>(null);

  // Gerar sugestões ao abrir a tela
  useEffect(() => {
    if (igrejaId) {
      gerarSugestoes({
        igreja_id: igrejaId,
        conta_id: contaFiltro !== "all" ? contaFiltro : undefined,
        mes_inicio: formatLocalDate(
          extratosCustomRange?.from
            ? extratosCustomRange.from
            : startOfMonthLocal(mesExtratos),
        ),
        mes_fim: formatLocalDate(
          extratosCustomRange?.to
            ? extratosCustomRange.to
            : endOfMonthLocal(mesExtratos),
        ),
        score_minimo: 0.7,
      });
    }
  }, [igrejaId, contaFiltro, mesExtratos, extratosCustomRange]);

  // Fetch accounts
  const { data: contas } = useQuery<Conta[]>({
    queryKey: ["contas-conciliacao", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data } = await supabase
        .from("contas")
        .select("id, nome")
        .eq("igreja_id", igrejaId)
        .eq("ativo", true);
      return data || [];
    },
    enabled: !!igrejaId,
  });

  // Fetch pending statements
  const { data: extratos, isLoading: loadingExtratos } = useQuery({
    queryKey: [
      "extratos-pendentes-inteligente",
      igrejaId,
      filialId,
      isAllFiliais,
      mesExtratos,
      extratosCustomRange,
    ],
    queryFn: async (): Promise<ExtratoItem[]> => {
      if (!igrejaId) return [];

      const inicio = extratosCustomRange?.from
        ? extratosCustomRange.from
        : startOfMonthLocal(mesExtratos);
      const fim = extratosCustomRange?.to
        ? extratosCustomRange.to
        : endOfMonthLocal(mesExtratos);

      let query = supabase
        .from("extratos_bancarios")
        .select("id, data_transacao, descricao, valor, tipo, conta_id")
        .eq("igreja_id", igrejaId)
        .eq("reconciliado", false)
        .is("transacao_vinculada_id", null)
        .not("descricao", "ilike", "%contamax%")
        .gte("data_transacao", formatLocalDate(inicio))
        .lte("data_transacao", formatLocalDate(fim))
        .order("data_transacao", { ascending: false });

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      if (contaFiltro !== "all") {
        query = query.eq("conta_id", contaFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ExtratoItem[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Fetch unreconciled transactions
  const { data: transacoes, isLoading: loadingTransacoes } = useQuery({
    queryKey: [
      "transacoes-pendentes-inteligente",
      igrejaId,
      filialId,
      isAllFiliais,
      mesTransacoes,
      transacoesCustomRange,
      contaFiltro,
    ],
    queryFn: async (): Promise<TransacaoItem[]> => {
      if (!igrejaId) return [];

      const inicio = startOfMonthLocal(mesTransacoes);
      const fim = endOfMonthLocal(mesTransacoes);

      // Buscar IDs de transações já vinculadas (conciliação 1:1 ou N:1)
      const { data: extratosVinculados } = await supabase
        .from("extratos_bancarios")
        .select("transacao_vinculada_id")
        .eq("igreja_id", igrejaId)
        .not("transacao_vinculada_id", "is", null);

      const { data: lotesVinculados } = await supabase
        .from("conciliacoes_lote")
        .select("transacao_id")
        .eq("igreja_id", igrejaId);

      const idsJaConciliados = new Set([
        ...(extratosVinculados || []).map((e) => e.transacao_vinculada_id),
        ...(lotesVinculados || []).map((l) => l.transacao_id),
      ]);

      let query = supabase
        .from("transacoes_financeiras")
        .select(
          "id, data_pagamento, data_vencimento, descricao, valor, valor_liquido, taxas_administrativas, juros, multas, desconto, tipo, conta_id, transferencia_id, status, conciliacao_status",
        )
        .eq("igreja_id", igrejaId)
        .in("status", ["pendente", "pago"])
        .order("data_pagamento", { ascending: false });

      // Filtro de data: para pagas usa data_pagamento, para pendentes usa data_vencimento
      // Precisamos fazer isso em memória após fetch ou usar RPC
      // Por enquanto vamos buscar com OR lógico via or()

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      if (contaFiltro !== "all") {
        query = query.eq("conta_id", contaFiltro);
      }

      const { data, error } = await query;
      if (error) throw error;

      const transacoesFiltradas = ((data || []) as TransacaoItem[]).filter(
        (t) => {
          // Ja esta sendo filtrado antes (idsJaConciliados), agora filtrar por data
          if (idsJaConciliados.has(t.id)) return false;
          if (t.conciliacao_status && t.conciliacao_status !== "nao_conciliado")
            return false;

          const inicio = transacoesCustomRange?.from
            ? transacoesCustomRange.from
            : startOfMonthLocal(mesTransacoes);
          const fim = transacoesCustomRange?.to
            ? transacoesCustomRange.to
            : endOfMonthLocal(mesTransacoes);

          if (t.status === "pendente") {
            // Pendentes: filtrar por data_vencimento
            const dataVenc = parseLocalDate(t.data_vencimento);
            if (!dataVenc) return false;
            return isWithinInterval(dataVenc, { start: inicio, end: fim });
          } else {
            // Pagas: filtrar por data_pagamento
            const dataPag = parseLocalDate(t.data_pagamento);
            if (!dataPag) return false;
            return isWithinInterval(dataPag, { start: inicio, end: fim });
          }
        },
      );

      return transacoesFiltradas;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Candidatos do motor ÚNICO de score (F4) — substitui o score heurístico
  // client-side. Mapa: extrato_id → (transacao_id → score 0..1).
  const { data: candidatosScore } = useQuery({
    queryKey: [
      "candidatos-motor-inteligente",
      igrejaId,
      filialId,
      isAllFiliais,
      contaFiltro,
      mesExtratos,
      extratosCustomRange,
    ],
    queryFn: async (): Promise<Map<string, Map<string, number>>> => {
      if (!igrejaId) return new Map();
      const inicio = extratosCustomRange?.from
        ? extratosCustomRange.from
        : startOfMonthLocal(mesExtratos);
      const fim = extratosCustomRange?.to
        ? extratosCustomRange.to
        : endOfMonthLocal(mesExtratos);
      const rows = await gerarCandidatosConciliacao({
        contaId: contaFiltro !== "all" ? contaFiltro : null,
        periodoInicio: formatLocalDate(inicio),
        periodoFim: formatLocalDate(fim),
        filialId: isAllFiliais ? null : filialId,
      });
      const mapa = new Map<string, Map<string, number>>();
      for (const r of rows) {
        // Só 1:1 vira "sugestão" para seleção individual. Candidatos 1:N
        // (divisão) têm fluxo próprio (DividirExtratoDialog) e NÃO podem ser
        // marcados como 1:1 — senão selecionar um único item da divisão
        // confirmaria uma conciliação 1:1 de valor parcial.
        if (r.tipo_match !== "1:1" || r.transacao_ids.length !== 1) continue;
        const tid = r.transacao_ids[0];
        let inner = mapa.get(r.extrato_id);
        if (!inner) {
          inner = new Map<string, number>();
          mapa.set(r.extrato_id, inner);
        }
        const prev = inner.get(tid) ?? 0;
        if (r.score > prev) inner.set(tid, r.score);
      }
      return mapa;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
    staleTime: 0,
  });

  // Filter extratos
  const extratosFiltrados = useMemo(() => {
    if (!extratos) return [];

    const inicio = extratosCustomRange?.from
      ? extratosCustomRange.from
      : startOfMonthLocal(mesExtratos);
    const fim = extratosCustomRange?.to
      ? extratosCustomRange.to
      : endOfMonthLocal(mesExtratos);

    return extratos.filter((e) => {
      if (
        searchExtrato &&
        !e.descricao.toLowerCase().includes(searchExtrato.toLowerCase())
      ) {
        return false;
      }
      if (tipoFiltro !== "all") {
        // Mapear: entrada = credito, saida = debito
        if (tipoFiltro === "entrada" && e.tipo !== "credito") return false;
        if (tipoFiltro === "saida" && e.tipo !== "debito") return false;
      }
      // Filtrar por data do mês
      const dataExtrato = parseLocalDate(e.data_transacao);
      if (!dataExtrato) return false;
      return isWithinInterval(dataExtrato, { start: inicio, end: fim });
    });
  }, [extratos, searchExtrato, tipoFiltro, mesExtratos, extratosCustomRange]);

  const extratoIds = useMemo(() => {
    return extratosFiltrados.map((extrato) => extrato.id);
  }, [extratosFiltrados]);

  // Hook para sugestões ML mapeadas por extrato
  const { sugestoesMap, refetch: refetchSugestoes } = useSuggestoesMLMapeadas(
    igrejaId,
    contaFiltro !== "all" ? contaFiltro : undefined,
    extratoIds,
  );

  // Filter transacoes
  const transacoesFiltradas = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((t) => {
      if (tipoFiltro !== "all" && t.tipo !== tipoFiltro) return false;
      return true;
    });
  }, [transacoes, tipoFiltro]);

  const sortedTransacoes = useMemo(() => {
    if (!transacoesFiltradas) return [];
    // Sugestão de transações candidatas só quando exatamente 1 extrato está
    // selecionado; o score vem do motor único (F4), não mais de heurística local.
    if (selectedExtratos.length !== 1) {
      return transacoesFiltradas.map((t) => ({ ...t, isSuggestion: false, score: 0 }));
    }

    const scores = candidatosScore?.get(selectedExtratos[0]);
    if (!scores || scores.size === 0) {
      return transacoesFiltradas.map((t) => ({ ...t, isSuggestion: false, score: 0 }));
    }

    return [...transacoesFiltradas]
      .map((transacao) => {
        const raw = scores.get(transacao.id);
        // Candidatos já vêm acima do corte do motor → todos são sugestões.
        const score = raw != null ? Math.round(raw * 100) : 0;
        return { ...transacao, score, isSuggestion: score > 0 };
      })
      .sort((a, b) => b.score - a.score);
  }, [transacoesFiltradas, selectedExtratos, candidatosScore]);

  const handleSelectExtrato = (id: string) => {
    setSelectedExtratos((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleSelectTransacao = (id: string) => {
    setSelectedTransacoes((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
    );
  };

  const handleOpenQuickCreate = (e: React.MouseEvent, extrato: ExtratoItem) => {
    e.stopPropagation();
    setExtratoParaQuickCreate(extrato);
    setQuickCreateDialogOpen(true);
  };

  const handleQuickCreateSuccess = () => {
    queryClient.invalidateQueries({
      queryKey: ["extratos-pendentes-inteligente"],
    });
    queryClient.invalidateQueries({
      queryKey: ["transacoes-pendentes-inteligente"],
    });
  };

  const confirmarConciliacao = useMutation({
    mutationFn: async () => {
      if (selectedExtratos.length === 0 || selectedTransacoes.length === 0) {
        throw new Error("Selecione pelo menos um item de cada lado");
      }

      // Confirmação transacional (fin_confirmar_conciliacao, ADR-030/F3): o
      // formato (1:1, N:1, 1:N) é inferido pela cardinalidade no banco, numa
      // única transação — substitui os ~6 updates sequenciais deste fluxo.
      const vinculo: VinculoConciliacao = {
        extrato_ids: selectedExtratos,
        transacao_ids: selectedTransacoes,
      };

      // 1 extrato → N transações = divisão; o split usa o valor de cada uma.
      if (selectedExtratos.length === 1 && selectedTransacoes.length > 1) {
        vinculo.divisoes = selectedTransacoes.map((transacaoId) => {
          const transacao = transacoesFiltradas?.find(
            (t) => t.id === transacaoId,
          );
          return { transacao_id: transacaoId, valor: Number(transacao?.valor) || 0 };
        });
      } else if (selectedExtratos.length > 1 && selectedTransacoes.length > 1) {
        throw new Error(
          "Múltiplos extratos com múltiplas transações não é suportado",
        );
      }

      await confirmarConciliacaoRpc(vinculo);
    },
    onSuccess: () => {
      toast.success(
        `${selectedExtratos.length} extrato(s) conciliado(s) com sucesso!`,
      );
      setSelectedExtratos([]);
      setSelectedTransacoes([]);
      queryClient.invalidateQueries({
        queryKey: ["extratos-pendentes-inteligente"],
      });
      queryClient.invalidateQueries({
        queryKey: ["transacoes-pendentes-inteligente"],
      });
    },
    onError: (error) => {
      console.error("❌ Erro na conciliação:", error);
      toast.error("Erro ao conciliar: " + (error as Error).message);
    },
  });

  // Mutation para rejeitar sugestão
  const rejeitarSugestao = useMutation({
    mutationFn: async (sugestaoId: string) => {
      const { data } = await supabase.auth.getUser();
      const authUserId = data?.user?.id;

      let usuarioProfileId: string | null = null;
      if (authUserId) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", authUserId)
          .maybeSingle();
        usuarioProfileId = profile?.id ?? null;
      }

      const { error } = await supabase.rpc("rejeitar_sugestao_conciliacao", {
        p_sugestao_id: sugestaoId,
        p_usuario_id: usuarioProfileId,
      });
      if (error) {
        throw error;
      }
      return sugestaoId;
    },
    onSuccess: async () => {
      // Pequeno delay para garantir que o Postgres commitou a transação
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Invalidar todas as queries de sugestões ML (diferentes keys por extratoIds)
      await queryClient.invalidateQueries({
        queryKey: ["sugestoes-ml-mapeadas"],
        refetchType: "active",
      });

      toast.info("Sugestão rejeitada");
    },
    onError: (error) => {
      toast.error("Erro ao rejeitar: " + (error as Error).message);
    },
  });

  const { totalExtratos, totalTransacoes, diferenca } = useMemo(() => {
    const totalExtratos =
      extratosFiltrados
        ?.filter((e) => selectedExtratos.includes(e.id))
        .reduce((acc, item) => {
          return acc + (item.tipo === "credito" ? item.valor : -item.valor);
        }, 0) ?? 0;

    const totalTransacoes =
      transacoesFiltradas
        ?.filter((t) => selectedTransacoes.includes(t.id))
        .reduce((acc, item) => {
          return (
            acc +
            (item.tipo === "entrada"
              ? (item.valor_liquido ?? item.valor)
              : -(item.valor_liquido ?? item.valor))
          );
        }, 0) ?? 0;

    const diferenca = totalExtratos - totalTransacoes;
    return { totalExtratos, totalTransacoes, diferenca };
  }, [
    selectedExtratos,
    selectedTransacoes,
    extratosFiltrados,
    transacoesFiltradas,
  ]);

  return (
    <div className="space-y-4">
      {/* Filtros Globais */}
      <div className="flex gap-2 items-center p-3 bg-card border rounded-lg flex-shrink-0">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar extrato..."
            value={searchExtrato}
            onChange={(e) => setSearchExtrato(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={contaFiltro} onValueChange={setContaFiltro}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todas as contas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {contas?.map((conta) => (
              <SelectItem key={conta.id} value={conta.id}>
                {conta.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={tipoFiltro} onValueChange={setTipoFiltro}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="entrada">Entrada (Crédito)</SelectItem>
            <SelectItem value="saida">Saída (Débito)</SelectItem>
          </SelectContent>
        </Select>
        <Button
          size="icon"
          variant="outline"
          onClick={() =>
            gerarSugestoes({
              igreja_id: igrejaId!,
              conta_id: contaFiltro !== "all" ? contaFiltro : undefined,
              mes_inicio: formatLocalDate(
                extratosCustomRange?.from
                  ? extratosCustomRange.from
                  : startOfMonthLocal(mesExtratos),
              ),
              mes_fim: formatLocalDate(
                extratosCustomRange?.to
                  ? extratosCustomRange.to
                  : endOfMonthLocal(mesExtratos),
              ),
              score_minimo: 0.7,
            })
          }
          disabled={gerando}
          title="Regenerar sugestões ML"
        >
          {gerando ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
        </Button>
      </div>

      {/* Painéis com Layout Fixo */}
      <div className="flex gap-3 h-[calc(100vh-320px)]">
        {/* Painel Esquerdo - Extratos */}
        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-card">
          {/* Header com Month Picker */}
          <div className="flex-shrink-0 px-3 py-1.5 border-b bg-muted/30">
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="font-semibold text-sm">Banco</h3>
              <div className="flex items-center gap-1">
                <MonthPicker
                  selectedMonth={mesExtratos}
                  onMonthChange={setMesExtratos}
                  customRange={extratosCustomRange}
                  onCustomRangeChange={setExtratosCustomRange}
                  className="text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setSelectedExtratos([])}
                  title="Limpar seleção"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Extratos Pendentes</p>
          </div>

          {/* ScrollArea */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loadingExtratos && (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  Carregando...
                </p>
              )}
              {extratosFiltrados &&
                extratosFiltrados.length === 0 &&
                !loadingExtratos && (
                  <div className="text-xs text-muted-foreground px-2 py-1">
                    <p>Nenhum extrato pendente</p>
                    {extratos && extratos.length > 0 && (
                      <p className="text-xs text-amber-600 mt-1">
                        Total: {extratos.length} (filtrado:{" "}
                        {extratosFiltrados.length})
                      </p>
                    )}
                  </div>
                )}
              {extratosFiltrados?.map((item) => {
                const sugestao = sugestoesMap[item.id];

                // Modo A: Badge no extrato
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      handleSelectExtrato(item.id);
                      // Se tem sugestão, scroll até a transação correspondente
                      if (sugestao?.transacaoId) {
                        const transacaoElement = document.getElementById(
                          `transacao-${sugestao.transacaoId}`,
                        );
                        if (transacaoElement) {
                          transacaoElement.scrollIntoView({
                            behavior: "smooth",
                            block: "center",
                          });
                          // Highlight temporário
                          transacaoElement.classList.add(
                            "ring-2",
                            "ring-yellow-400",
                          );
                          setTimeout(() => {
                            transacaoElement.classList.remove(
                              "ring-2",
                              "ring-yellow-400",
                            );
                          }, 2000);
                        }
                      }
                    }}
                    className={cn(
                      "px-2 py-1.5 rounded border cursor-pointer transition-colors group",
                      selectedExtratos.includes(item.id)
                        ? "bg-blue-100 dark:bg-blue-900 border-blue-400"
                        : "border-border hover:bg-slate-50 dark:hover:bg-slate-800",
                    )}
                  >
                    <ExtratoSugestaoMLA
                      extratoId={item.id}
                      valor={item.valor}
                      data={item.data_transacao}
                      descricao={anonymizePixDescription(item.descricao)}
                      tipo={item.tipo}
                      sugestao={
                        sugestao
                          ? {
                              transacaoDescricao: sugestao.transacaoDescricao,
                              transacaoValor: sugestao.transacaoValor,
                              transacaoData: sugestao.transacaoData,
                              score: sugestao.score,
                              tipoMatch: sugestao.tipoMatch,
                              diferencaDias: sugestao.diferencaDias,
                              sugestaoId: sugestao.sugestaoId,
                              onAceitar: () => {
                                // Selecionar extrato e transação sugerida
                                setSelectedExtratos([item.id]);
                                if (sugestao.transacaoId) {
                                  setSelectedTransacoes([sugestao.transacaoId]);
                                }
                                toast.success(
                                  'Sugestão aceita - clique em "Confirmar" para vincular',
                                );
                              },
                              onRejeitar: () => {
                                // Chamar mutation de rejeição que atualiza DB e refetch
                                rejeitarSugestao.mutate(sugestao.sugestaoId);
                              },
                              isRejecting: rejeitarSugestao.isPending,
                            }
                          : undefined
                      }
                    />
                    <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={(e) => handleOpenQuickCreate(e, item)}
                        title="Criar transação rápida"
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(item.id);
                          toast.success("ID copiado!");
                        }}
                        className="text-[10px] font-mono text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded hover:bg-muted transition-colors flex-shrink-0"
                        title="Copiar ID do extrato"
                      >
                        {item.id.substring(0, 6)}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>

        {/* Barra de Balanço - No Meio */}
        <div className="flex-shrink-0 w-32 flex flex-col items-center justify-center gap-2 p-3 bg-card rounded-lg border">
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">
              Banco
            </p>
            <p className="font-bold text-xs text-green-600">
              {formatValue(totalExtratos)}
            </p>
          </div>
          <div className="w-full h-px bg-border"></div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">
              Diferença
            </p>
            <p
              className={cn(
                "font-bold text-sm",
                Math.abs(diferenca) < 0.01 &&
                  (selectedExtratos.length > 0 || selectedTransacoes.length > 0)
                  ? "text-green-600"
                  : "text-red-600",
              )}
            >
              {Math.abs(diferenca) < 0.01 ? "R$ 0,00" : formatValue(diferenca)}
            </p>
          </div>
          <div className="w-full h-px bg-border"></div>
          <div className="text-center">
            <p className="text-[10px] text-muted-foreground leading-tight mb-0.5">
              Sistema
            </p>
            <p className="font-bold text-xs text-blue-600">
              {formatValue(totalTransacoes)}
            </p>
          </div>
          <Button
            className="w-full mt-2"
            size="sm"
            disabled={
              Math.abs(diferenca) >= 0.01 ||
              (selectedExtratos.length === 0 &&
                selectedTransacoes.length === 0) ||
              confirmarConciliacao.isPending
            }
            onClick={() => confirmarConciliacao.mutate()}
          >
            {confirmarConciliacao.isPending ? (
              <>
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                <span className="text-xs">Aguarde...</span>
              </>
            ) : (
              <span className="text-xs">Confirmar</span>
            )}
          </Button>
        </div>

        {/* Painel Direito - Transações */}
        <div className="flex-1 flex flex-col border rounded-lg overflow-hidden bg-card">
          {/* Header com Month Picker */}
          <div className="flex-shrink-0 px-3 py-1.5 border-b bg-muted/30">
            <div className="flex items-center justify-between mb-0.5">
              <h3 className="font-semibold text-sm">Sistema</h3>
              <div className="flex items-center gap-1">
                <MonthPicker
                  selectedMonth={mesTransacoes}
                  onMonthChange={setMesTransacoes}
                  customRange={transacoesCustomRange}
                  onCustomRangeChange={setTransacoesCustomRange}
                  className="text-xs"
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => setSelectedTransacoes([])}
                  title="Limpar seleção"
                >
                  <RotateCcw className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-none">
              Transações Pendentes
            </p>
          </div>

          {/* ScrollArea */}
          <ScrollArea className="flex-1">
            <div className="p-2 space-y-1">
              {loadingTransacoes && (
                <p className="text-xs text-muted-foreground px-2 py-1">
                  Carregando...
                </p>
              )}
              {sortedTransacoes &&
                sortedTransacoes.length === 0 &&
                !loadingTransacoes && (
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    Nenhuma transação pendente
                  </p>
                )}
              {sortedTransacoes?.map((item) => (
                <div
                  key={item.id}
                  id={`transacao-${item.id}`}
                  className={cn(
                    "px-2 py-1.5 rounded border cursor-pointer transition-colors text-xs group",
                    selectedTransacoes.includes(item.id)
                      ? "bg-blue-100 dark:bg-blue-900 border-blue-400"
                      : item.isSuggestion
                        ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900/40"
                        : "border-border hover:bg-slate-50 dark:hover:bg-slate-800",
                  )}
                >
                  <div onClick={() => handleSelectTransacao(item.id)}>
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-medium truncate">{item.descricao}</p>
                      {item.status === "pendente" && (
                        <span className="text-[9px] bg-orange-100 text-orange-700 px-1.5 py-0 rounded whitespace-nowrap">
                          pendente
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const data = parseLocalDate(
                            item.status === "pendente"
                              ? item.data_vencimento!
                              : item.data_pagamento!,
                          );
                          return data
                            ? format(data, "dd/MM", { locale: ptBR })
                            : "-";
                        })()}
                      </p>
                      <p
                        className={cn(
                          "font-bold text-xs",
                          selectedTransacoes.includes(item.id)
                            ? "text-blue-700 dark:text-blue-300"
                            : item.tipo === "entrada"
                              ? "text-green-600"
                              : "text-red-600",
                        )}
                      >
                        {formatValue(item.valor_liquido ?? item.valor)}
                      </p>
                    </div>
                  </div>
                  {/* Botões de ação */}
                  <div className="flex gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTransacaoSelecionada(item);
                        setTransacaoDetalheOpen(true);
                      }}
                      title="Ajustar valores (taxas, juros, etc.)"
                    >
                      <Settings className="w-3 h-3" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          const { error } = await supabase
                            .from("transacoes_financeiras")
                            .update({ conciliacao_status: "conciliado_manual" })
                            .eq("id", item.id);

                          if (error) throw error;

                          toast.success(
                            "Transação marcada como conciliada manualmente",
                          );
                          // Remover da lista local sem esperar refetch
                          setSelectedTransacoes((prev) =>
                            prev.filter((id) => id !== item.id),
                          );
                          queryClient.invalidateQueries({
                            queryKey: ["transacoes-conciliacao"],
                          });
                        } catch (error) {
                          console.error(
                            "Erro ao marcar conciliação manual:",
                            error,
                          );
                          toast.error("Erro ao marcar conciliação manual");
                        }
                      }}
                      title="Marcar como conciliado manualmente"
                    >
                      <CheckCircle2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>

      <QuickCreateTransacaoDialog
        open={quickCreateDialogOpen}
        onOpenChange={setQuickCreateDialogOpen}
        extratoItem={extratoParaQuickCreate}
        onSuccess={handleQuickCreateSuccess}
      />

      {transacaoSelecionada && (
        <TransacaoDetalheDrawer
          open={transacaoDetalheOpen}
          onOpenChange={setTransacaoDetalheOpen}
          transacao={{
            id: transacaoSelecionada.id,
            descricao: transacaoSelecionada.descricao,
            valor: transacaoSelecionada.valor,
            valor_liquido: transacaoSelecionada.valor_liquido,
            taxas_administrativas: transacaoSelecionada.taxas_administrativas,
            juros: transacaoSelecionada.juros,
            multas: transacaoSelecionada.multas,
            desconto: transacaoSelecionada.desconto,
            data_pagamento: transacaoSelecionada.data_pagamento,
          }}
          onUpdated={() => {
            queryClient.invalidateQueries({
              queryKey: ["transacoes-pendentes-inteligente"],
            });
            toast.success("Valores atualizados");
          }}
        />
      )}
    </div>
  );
}
