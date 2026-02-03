import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Determine status based on difference
      const status = Math.abs(diferenca) < 0.01 ? "conciliada" : "discrepancia";

      // Create the batch record
      const { data: lote, error: loteError } = await supabase
        .from("conciliacoes_lote")
        .insert({
          transacao_id: transacao.id,
          igreja_id: igrejaId,
          filial_id: filialId || null,
          conta_id: effectiveContaId || null,
          valor_transacao: valorTransacao,
          valor_extratos: somaSelecionados,
          status,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (loteError) throw loteError;

      // Link all selected statements to the batch
      const vinculos = Array.from(selectedExtratos).map(extratoId => ({
        conciliacao_lote_id: lote.id,
        extrato_id: extratoId,
      }));

      const { error: vinculoError } = await supabase
        .from("conciliacoes_lote_extratos")
        .insert(vinculos);

      if (vinculoError) throw vinculoError;

      // Mark statements as reconciled
      const { error: updateError } = await supabase
        .from("extratos_bancarios")
        .update({ reconciliado: true })
        .in("id", Array.from(selectedExtratos));

      if (updateError) throw updateError;

      // Insert audit logs for batch reconciliation
      const extratosParaLog = extratosFiltrados.filter(e => selectedExtratos.has(e.id));
      const auditLogs = extratosParaLog.map(extrato => ({
        extrato_id: extrato.id,
        transacao_id: transacao.id,
        conciliacao_lote_id: lote.id,
        igreja_id: igrejaId,
        filial_id: filialId || null,
        conta_id: effectiveContaId || null,
        tipo_reconciliacao: "lote" as const,
        valor_extrato: Math.abs(extrato.valor),
        valor_transacao: valorTransacao,
        diferenca: Math.abs(Math.abs(extrato.valor) - valorTransacao),
        usuario_id: user.id,
        observacoes: `Conciliação em lote - ${status}`,
      }));

      if (auditLogs.length > 0) {
        const { error: auditError } = await supabase
          .from("reconciliacao_audit_logs")
          .insert(auditLogs);
        
        if (auditError) {
          console.warn("Erro ao inserir logs de auditoria:", auditError);
          // Não falha a operação principal por causa do log
        }
      }

      return { loteId: lote.id, count: selectedExtratos.size, status };
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
