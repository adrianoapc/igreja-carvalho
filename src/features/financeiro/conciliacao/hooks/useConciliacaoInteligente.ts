import { useState, useMemo, useEffect } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { useGerarSuggestoesConciliacao } from "@/hooks/useGerarSuggestoesConciliacao";
import { useSuggestoesMLMapeadas } from "@/hooks/useSuggestoesMLMapeadas";
import {
  confirmarConciliacao as confirmarConciliacaoRpc,
  alternarConferenciaManual,
  type VinculoConciliacao,
} from "@/features/financeiro/core";
import { gerarCandidatosConciliacao } from "@/features/financeiro/core/api/conciliacao.api";
import { isWithinInterval } from "date-fns";
import {
  parseLocalDate,
  formatLocalDate,
  startOfMonthLocal,
  endOfMonthLocal,
} from "@/utils/dateUtils";
import { toast } from "sonner";

export interface ExtratoItem {
  id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  conta_id: string;
  origem?: string | null;
  possivel_duplicata_de?: string | null;
}

export interface TransacaoItem {
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

export interface Conta {
  id: string;
  nome: string;
}

/**
 * Toda a lógica de dados/mutações da tela de Conciliação Inteligente
 * (queries, filtros, motor de score F4, confirmação, marcação manual e
 * rejeição de sugestão). Extraído do componente original (F7 sub-frente 2/5)
 * para viabilizar a decomposição em subcomponentes focados + responsivos —
 * mesmas query keys do arquivo original ("extratos-pendentes-inteligente",
 * "transacoes-pendentes-inteligente", "candidatos-motor-inteligente",
 * "contas-conciliacao", "transacoes-conciliacao") preservadas de propósito:
 * QuickCreateTransacaoDialog e ConciliacaoManual invalidam algumas delas.
 */
export function useConciliacaoInteligente() {
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const queryClient = useQueryClient();
  const { gerarSugestoes, isPending: gerando } =
    useGerarSuggestoesConciliacao();

  const [selectedExtratos, setSelectedExtratos] = useState<string[]>([]);
  const [selectedTransacoes, setSelectedTransacoes] = useState<string[]>([]);

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

  const regenerarSugestoes = () => {
    if (!igrejaId) return;
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
  };

  // Gerar sugestões ao abrir a tela
  useEffect(() => {
    regenerarSugestoes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [igrejaId, contaFiltro, mesExtratos, extratosCustomRange]);

  // Fetch accounts (só ativas — usada no filtro "Todas as contas"; não faz
  // sentido deixar o usuário filtrar por uma conta desativada).
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

  // Todas as contas, incluindo desativadas (P2 do review da PR #54): o badge
  // de conta no painel "Sistema" precisa resolver o nome mesmo de uma
  // transação pendente ligada a uma conta já desativada — a lista de
  // `transacoesFiltradas`/`sortedTransacoes` abaixo não filtra por
  // contas.ativo, então o lookup não pode filtrar também, senão o badge some
  // silenciosamente pra essas transações.
  const { data: contasComInativas } = useQuery<Conta[]>({
    queryKey: ["contas-conciliacao-todas", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      const { data } = await supabase
        .from("contas")
        .select("id, nome")
        .eq("igreja_id", igrejaId);
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
        .select("id, data_transacao, descricao, valor, tipo, conta_id, origem, possivel_duplicata_de")
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
      // `possivel_duplicata_de` ainda não está em types.ts gerado (coluna
      // nova, ver HistoricoExtratos.tsx para o mesmo padrão) — cast via
      // unknown até a próxima regeneração de tipos.
      return (data || []) as unknown as ExtratoItem[];
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
            const dataVenc = parseLocalDate(t.data_vencimento);
            if (!dataVenc) return false;
            return isWithinInterval(dataVenc, { start: inicio, end: fim });
          } else {
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
        if (tipoFiltro === "entrada" && e.tipo !== "credito") return false;
        if (tipoFiltro === "saida" && e.tipo !== "debito") return false;
      }
      const dataExtrato = parseLocalDate(e.data_transacao);
      if (!dataExtrato) return false;
      return isWithinInterval(dataExtrato, { start: inicio, end: fim });
    });
  }, [extratos, searchExtrato, tipoFiltro, mesExtratos, extratosCustomRange]);

  const extratoIds = useMemo(() => {
    return extratosFiltrados.map((extrato) => extrato.id);
  }, [extratosFiltrados]);

  // Hook para sugestões ML mapeadas por extrato
  const { sugestoesMap } = useSuggestoesMLMapeadas(
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
      console.error("Erro na conciliação:", error);
      toast.error("Erro ao conciliar: " + (error as Error).message);
    },
  });

  // Mutation para marcar conciliação manual (sem extrato correspondente)
  const marcarConferenciaManual = useMutation({
    mutationFn: async (transacaoId: string) => {
      await alternarConferenciaManual(transacaoId, true);
      return transacaoId;
    },
    onSuccess: (transacaoId) => {
      toast.success("Transação marcada como conciliada manualmente");
      setSelectedTransacoes((prev) => prev.filter((id) => id !== transacaoId));
      queryClient.invalidateQueries({ queryKey: ["transacoes-conciliacao"] });
      queryClient.invalidateQueries({
        queryKey: ["transacoes-pendentes-inteligente"],
      });
    },
    onError: (error) => {
      console.error("Erro ao marcar conciliação manual:", error);
      toast.error("Erro ao marcar conciliação manual");
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

  return {
    // filtros
    contas,
    contasComInativas,
    contaFiltro,
    setContaFiltro,
    tipoFiltro,
    setTipoFiltro,
    searchExtrato,
    setSearchExtrato,
    regenerarSugestoes,
    gerando,
    // extratos
    extratosFiltrados,
    totalExtratosBrutos: extratos?.length ?? 0,
    loadingExtratos,
    mesExtratos,
    setMesExtratos,
    extratosCustomRange,
    setExtratosCustomRange,
    sugestoesMap,
    selectedExtratos,
    setSelectedExtratos,
    handleSelectExtrato,
    // transacoes
    sortedTransacoes,
    loadingTransacoes,
    mesTransacoes,
    setMesTransacoes,
    transacoesCustomRange,
    setTransacoesCustomRange,
    selectedTransacoes,
    setSelectedTransacoes,
    handleSelectTransacao,
    // totais + ações
    totalExtratos,
    totalTransacoes,
    diferenca,
    confirmarConciliacao,
    marcarConferenciaManual,
    rejeitarSugestao,
  };
}

export type UseConciliacaoInteligenteReturn = ReturnType<
  typeof useConciliacaoInteligente
>;
