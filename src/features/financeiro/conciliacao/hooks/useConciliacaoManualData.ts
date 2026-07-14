import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { formatLocalDate } from "@/utils/dateUtils";
import { marcarExtratoIgnorado } from "@/features/financeiro/core/api/extratos.api";
import { gerarCandidatosConciliacao } from "@/features/financeiro/core/api/conciliacao.api";
import { toast } from "sonner";
import type {
  ExtratoItem,
  TransacaoConciliacao,
  ContaConciliacao,
} from "../model/types";
import type { AutoReconciliarCandidato } from "./useAutoReconciliar";

const ITEMS_PER_PAGE = 15;

/**
 * Dados/filtros/paginação da tela Conciliação Manual (Modo Clássico) — F7
 * sub-frente 2/5. Mesmas query keys do arquivo original preservadas
 * ("extratos-pendentes", "transacoes-conciliacao", "transacoes-ja-vinculadas",
 * "contas-conciliacao") — "transacoes-conciliacao" é invalidada também pela
 * ConciliacaoInteligente ao marcar conferência manual.
 */
export function useConciliacaoManualData() {
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const queryClient = useQueryClient();

  // Date filter state - start with previous month since current month often has no data yet
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });
  const [customRange, setCustomRange] = useState<{ from: Date; to: Date } | null>(null);

  // Extrato tab state
  const [selectedContaId, setSelectedContaId] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");
  const [origemFiltro, setOrigemFiltro] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // Transacao tab state
  const [transacaoSearchTerm, setTransacaoSearchTerm] = useState("");
  const [transacaoPage, setTransacaoPage] = useState(1);
  const [transacaoContaFilter, setTransacaoContaFilter] = useState<string>("all");
  const [transacaoTipoFilter, setTransacaoTipoFilter] = useState<string>("all");
  const [transacaoOrigemFilter, setTransacaoOrigemFilter] = useState<string>("all");

  const { dataInicio, dataFim } = useMemo(() => {
    if (customRange) {
      return {
        dataInicio: formatLocalDate(customRange.from),
        dataFim: formatLocalDate(customRange.to),
      };
    }
    const startOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const endOfMonth = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 0);
    return {
      dataInicio: formatLocalDate(startOfMonth),
      dataFim: formatLocalDate(endOfMonth),
    };
  }, [selectedMonth, customRange]);

  const { data: contas } = useQuery<ContaConciliacao[]>({
    queryKey: ["contas-conciliacao", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome, tipo")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  const {
    data: extratos,
    isLoading: loadingExtratos,
    refetch: refetchExtratos,
  } = useQuery<ExtratoItem[]>({
    queryKey: [
      "extratos-pendentes",
      igrejaId,
      filialId,
      isAllFiliais,
      selectedContaId,
      dataInicio,
      dataFim,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("extratos_bancarios")
        .select("*, contas(nome)")
        .eq("igreja_id", igrejaId)
        .eq("reconciliado", false)
        .is("transacao_vinculada_id", null)
        .gte("data_transacao", dataInicio)
        .lte("data_transacao", dataFim)
        .order("data_transacao", { ascending: false })
        .limit(200);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      if (selectedContaId !== "all") {
        query = query.eq("conta_id", selectedContaId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as ExtratoItem[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  const { data: transacoes, isLoading: loadingTransacoes } = useQuery<
    TransacaoConciliacao[]
  >({
    queryKey: ["transacoes-conciliacao", igrejaId, filialId, isAllFiliais, dataInicio, dataFim],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select(
          "id, descricao, valor, tipo, data_pagamento, data_vencimento, status, conciliacao_status, conta_id, origem_registro, contas:conta_id(nome), categorias_financeiras(nome)",
        )
        .eq("igreja_id", igrejaId)
        // Inclui PENDENTES (casadas por data_vencimento): o motor F4 e
        // fin_confirmar_conciliacao baixam pendente→pago na conciliação, então a
        // lista/rotulagem precisa enxergá-las — pago casa por data_pagamento.
        .or(
          `and(status.eq.pago,data_pagamento.gte.${dataInicio},data_pagamento.lte.${dataFim}),` +
            `and(status.eq.pendente,data_vencimento.gte.${dataInicio},data_vencimento.lte.${dataFim})`,
        )
        .order("data_pagamento", { ascending: false, nullsFirst: false })
        .limit(500);

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as TransacaoConciliacao[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId,
  });

  // Fetch transaction IDs that are already reconciled (via any method)
  const { data: transacoesJaVinculadas } = useQuery({
    queryKey: ["transacoes-ja-vinculadas", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return new Set<string>();

      const { data: vinculadas1to1 } = await supabase
        .from("extratos_bancarios")
        .select("transacao_vinculada_id")
        .eq("igreja_id", igrejaId)
        .not("transacao_vinculada_id", "is", null);

      const { data: lotes } = await supabase
        .from("conciliacoes_lote")
        .select("transacao_id")
        .eq("igreja_id", igrejaId);

      const { data: divisoes } = await supabase
        .from("conciliacoes_divisao_transacoes")
        .select("transacao_id");

      const ids = new Set<string>();
      vinculadas1to1?.forEach((e) => e.transacao_vinculada_id && ids.add(e.transacao_vinculada_id));
      lotes?.forEach((l) => l.transacao_id && ids.add(l.transacao_id));
      divisoes?.forEach((d) => d.transacao_id && ids.add(d.transacao_id));

      return ids;
    },
    enabled: !igrejaLoading && !!igrejaId,
  });

  const extratosFiltrados = useMemo(() => {
    if (!extratos) return [];
    return extratos.filter((e) => {
      if (e.descricao?.toUpperCase().includes("CONTAMAX")) return false;
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (
          !e.descricao.toLowerCase().includes(search) &&
          !e.contas?.nome.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (tipoFiltro !== "all") {
        const tipoNormalizado =
          e.tipo?.toLowerCase() === "credit"
            ? "credito"
            : e.tipo?.toLowerCase() === "debit"
              ? "debito"
              : e.tipo?.toLowerCase();
        if (tipoNormalizado !== tipoFiltro) return false;
      }
      if (origemFiltro !== "all" && e.origem !== origemFiltro) return false;
      return true;
    });
  }, [extratos, searchTerm, tipoFiltro, origemFiltro]);

  const transacoesPendentes = useMemo(() => {
    if (!transacoes) return [];
    return transacoes.filter((t) => {
      if (transacoesJaVinculadas?.has(t.id)) return false;
      if (t.conciliacao_status && t.conciliacao_status !== "nao_conciliado") return false;

      if (transacaoSearchTerm) {
        const search = transacaoSearchTerm.toLowerCase();
        if (
          !t.descricao.toLowerCase().includes(search) &&
          !t.categorias_financeiras?.nome.toLowerCase().includes(search)
        ) {
          return false;
        }
      }
      if (transacaoContaFilter !== "all" && t.conta_id !== transacaoContaFilter) return false;
      if (transacaoTipoFilter !== "all" && t.tipo !== transacaoTipoFilter) return false;
      if (transacaoOrigemFilter !== "all") {
        const origem = (t.origem_registro || "manual").toLowerCase();
        if (origem !== transacaoOrigemFilter) return false;
      }
      return true;
    });
  }, [
    transacoes,
    transacaoSearchTerm,
    transacoesJaVinculadas,
    transacaoContaFilter,
    transacaoTipoFilter,
    transacaoOrigemFilter,
  ]);

  // Reset pages on filter change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedContaId, tipoFiltro, origemFiltro]);

  useMemo(() => {
    setTransacaoPage(1);
  }, [transacaoSearchTerm, transacaoContaFilter, transacaoTipoFilter, transacaoOrigemFilter]);

  const totalPages = Math.ceil(extratosFiltrados.length / ITEMS_PER_PAGE);
  const paginatedExtratos = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return extratosFiltrados.slice(start, start + ITEMS_PER_PAGE);
  }, [extratosFiltrados, currentPage]);

  const transacaoTotalPages = Math.ceil(transacoesPendentes.length / ITEMS_PER_PAGE);
  const paginatedTransacoes = useMemo(() => {
    const start = (transacaoPage - 1) * ITEMS_PER_PAGE;
    return transacoesPendentes.slice(start, start + ITEMS_PER_PAGE);
  }, [transacoesPendentes, transacaoPage]);

  const handleIgnorar = async (extratoId: string) => {
    try {
      await marcarExtratoIgnorado(extratoId, true);
      toast.success("Extrato marcado como ignorado");
      refetchExtratos();
    } catch (err) {
      console.error("Exceção ao ignorar:", err);
      toast.error("Erro ao ignorar extrato");
    }
  };

  const invalidarAposVinculo = () => {
    refetchExtratos();
    queryClient.invalidateQueries({ queryKey: ["transacoes-conciliacao"] });
    queryClient.invalidateQueries({ queryKey: ["transacoes-ja-vinculadas"] });
  };

  /** Candidatos 1:1 do motor único, por conta, para o "Reconciliar Automático". */
  const buscarCandidatosAutoReconciliar = async (): Promise<
    AutoReconciliarCandidato[]
  > => {
    if (!extratos || extratos.length === 0) return [];
    const contaIds = [...new Set(extratos.map((e) => e.conta_id))];
    const out: AutoReconciliarCandidato[] = [];
    for (const contaId of contaIds) {
      try {
        const rows = await gerarCandidatosConciliacao({
          contaId,
          periodoInicio: dataInicio,
          periodoFim: dataFim,
          filialId: isAllFiliais ? null : filialId,
        });
        for (const r of rows) {
          if (r.tipo_match === "1:1" && r.transacao_ids.length === 1) {
            out.push({
              extrato_id: r.extrato_id,
              transacao_id: r.transacao_ids[0],
              score: r.score,
            });
          }
        }
      } catch (err) {
        console.error("Erro ao gerar candidatos:", err);
      }
    }
    return out;
  };

  const obterExtrato = (id: string) => extratos?.find((e) => e.id === id);
  const obterTransacao = (id: string) => {
    const t = transacoes?.find((tx) => tx.id === id);
    return t ? { descricao: t.descricao, valor: Number(t.valor) } : undefined;
  };

  return {
    // month/date filter
    selectedMonth,
    setSelectedMonth,
    customRange,
    setCustomRange,
    // extrato tab
    contas,
    selectedContaId,
    setSelectedContaId,
    searchTerm,
    setSearchTerm,
    tipoFiltro,
    setTipoFiltro,
    origemFiltro,
    setOrigemFiltro,
    extratosFiltrados,
    paginatedExtratos,
    loadingExtratos,
    currentPage,
    setCurrentPage,
    totalPages,
    // transacao tab
    transacaoSearchTerm,
    setTransacaoSearchTerm,
    transacaoContaFilter,
    setTransacaoContaFilter,
    transacaoTipoFilter,
    setTransacaoTipoFilter,
    transacaoOrigemFilter,
    setTransacaoOrigemFilter,
    transacoesPendentes,
    paginatedTransacoes,
    loadingTransacoes,
    transacaoPage,
    setTransacaoPage,
    transacaoTotalPages,
    // actions
    handleIgnorar,
    invalidarAposVinculo,
    buscarCandidatosAutoReconciliar,
    obterExtrato,
    obterTransacao,
    extratosBrutos: extratos,
  };
}
