import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { confirmarConciliacao } from "@/features/financeiro/core";
import { useIgrejaId } from "@/hooks/useIgrejaId";
import { useFilialId } from "@/hooks/useFilialId";
import { toast } from "sonner";
import { format, subDays, addDays, parseISO } from "date-fns";

interface ExtratoItem {
  id: string;
  conta_id: string;
  data_transacao: string;
  descricao: string;
  valor: number;
  tipo: string;
  reconciliado: boolean;
  transacao_vinculada_id?: string | null;
  contas?: { nome: string } | null;
}

interface Transacao {
  id: string;
  descricao: string;
  valor: number;
  tipo: string;
  data_pagamento: string;
  categorias_financeiras?: { nome: string } | null;
  conta_id?: string | null;
  transferencia_id?: string | null;
}

interface UseConciliacaoLoteParams {
  transacao: Transacao | null;
  contaId?: string;
  dataInicio?: string;
  dataFim?: string;
}

export function useConciliacaoLote({ 
  transacao, 
  contaId,
  dataInicio,
  dataFim 
}: UseConciliacaoLoteParams) {
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const { filialId, isAllFiliais, loading: filialLoading } = useFilialId();
  const queryClient = useQueryClient();
  
  const [selectedExtratos, setSelectedExtratos] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<string>("all");

  // Calculate default date range based on transaction date
  const defaultDataInicio = transacao?.data_pagamento 
    ? format(subDays(parseISO(transacao.data_pagamento), 3), "yyyy-MM-dd")
    : format(subDays(new Date(), 7), "yyyy-MM-dd");
    
  const defaultDataFim = transacao?.data_pagamento
    ? format(addDays(parseISO(transacao.data_pagamento), 3), "yyyy-MM-dd")
    : format(new Date(), "yyyy-MM-dd");

  const effectiveDataInicio = dataInicio || defaultDataInicio;
  const effectiveDataFim = dataFim || defaultDataFim;
  const effectiveContaId = contaId || transacao?.conta_id;

  // Fetch available (non-reconciled) bank statements
  const { 
    data: extratosDisponiveis, 
    isLoading: loadingExtratos,
    refetch: refetchExtratos 
  } = useQuery({
    queryKey: [
      "extratos-lote",
      igrejaId,
      filialId,
      isAllFiliais,
      effectiveContaId,
      effectiveDataInicio,
      effectiveDataFim,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      
      let query = supabase
        .from("extratos_bancarios")
        .select("*, contas(nome)")
        .eq("igreja_id", igrejaId)
        .eq("reconciliado", false)
        .is("transacao_vinculada_id", null)
        .gte("data_transacao", effectiveDataInicio)
        .lte("data_transacao", effectiveDataFim)
        .order("data_transacao", { ascending: true });

      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      
      if (effectiveContaId) {
        query = query.eq("conta_id", effectiveContaId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ExtratoItem[];
    },
    enabled: !igrejaLoading && !filialLoading && !!igrejaId && !!transacao,
  });

  // Filter by search term and type
  const extratosFiltrados = useMemo(() => {
    if (!extratosDisponiveis) return [];
    
    const tipoTransacao = transacao?.tipo === "entrada" ? "credito" : "debito";
    
    return extratosDisponiveis.filter((e) => {
      // Filter out CONTAMAX
      if (e.descricao?.toUpperCase().includes("CONTAMAX")) return false;
      
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        if (!e.descricao.toLowerCase().includes(search)) return false;
      }
      
      // Type filter - default to matching transaction type
      if (tipoFiltro === "all") {
        // Only show matching type by default
        const tipoNormalizado = e.tipo?.toLowerCase() === "credit" ? "credito" : 
                               e.tipo?.toLowerCase() === "debit" ? "debito" : 
                               e.tipo?.toLowerCase();
        return tipoNormalizado === tipoTransacao;
      } else {
        const tipoNormalizado = e.tipo?.toLowerCase() === "credit" ? "credito" : 
                               e.tipo?.toLowerCase() === "debit" ? "debito" : 
                               e.tipo?.toLowerCase();
        return tipoNormalizado === tipoFiltro;
      }
    });
  }, [extratosDisponiveis, searchTerm, tipoFiltro, transacao?.tipo]);

  // Calculate totals
  const somaSelecionados = useMemo(() => {
    return extratosFiltrados
      .filter(e => selectedExtratos.has(e.id))
      .reduce((sum, e) => sum + Math.abs(e.valor), 0);
  }, [extratosFiltrados, selectedExtratos]);

  const valorTransacao = transacao?.valor ? Math.abs(Number(transacao.valor)) : 0;
  const diferenca = valorTransacao - somaSelecionados;

  // Toggle selection
  const toggleExtrato = (id: string) => {
    setSelectedExtratos(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Select all visible
  const selectAll = () => {
    setSelectedExtratos(new Set(extratosFiltrados.map(e => e.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedExtratos(new Set());
  };

  // Create batch reconciliation
  const createLoteMutation = useMutation({
    mutationFn: async () => {
      if (!transacao || !igrejaId || selectedExtratos.size === 0) {
        throw new Error("Dados insuficientes para criar lote");
      }

      // Conciliação N:1 atômica via fin_confirmar_conciliacao (ADR-030/F3):
      // cria o lote, vincula os N extratos, marca reconciliado e concilia a
      // transação (+ irmã de transferência) numa única transação. O status
      // do lote (conciliada × discrepancia) é derivado no banco pela
      // diferença extratos × transação.
      const status = Math.abs(diferenca) < 0.01 ? "conciliada" : "discrepancia";

      const resultado = await confirmarConciliacao({
        extrato_ids: Array.from(selectedExtratos),
        transacao_ids: [transacao.id],
      });
      resultado.warnings?.forEach((w) => console.warn(w));

      return { count: selectedExtratos.size, status };
    },
    onSuccess: (result) => {
      const message = result.status === "conciliada" 
        ? `${result.count} extrato(s) conciliado(s) com sucesso!`
        : `${result.count} extrato(s) vinculado(s) com discrepância de valor`;
      
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: ["extratos-lote"] });
      queryClient.invalidateQueries({ queryKey: ["extratos-pendentes"] });
      queryClient.invalidateQueries({ queryKey: ["transacoes-conciliacao"] });
      queryClient.invalidateQueries({ queryKey: ["transacoes-pendentes-lote"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliacao-cobertura"] });
      queryClient.invalidateQueries({ queryKey: ["reconciliacao-estatisticas"] });
    },
    onError: (error) => {
      console.error("Erro ao criar lote:", error);
      toast.error("Erro ao criar conciliação em lote");
    },
  });

  return {
    // Data
    extratosDisponiveis: extratosFiltrados,
    loadingExtratos,
    selectedExtratos,
    somaSelecionados,
    valorTransacao,
    diferenca,
    
    // Filters
    searchTerm,
    setSearchTerm,
    tipoFiltro,
    setTipoFiltro,
    
    // Actions
    toggleExtrato,
    selectAll,
    clearSelection,
    createLote: createLoteMutation.mutateAsync,
    isCreating: createLoteMutation.isPending,
    refetchExtratos,
  };
}
