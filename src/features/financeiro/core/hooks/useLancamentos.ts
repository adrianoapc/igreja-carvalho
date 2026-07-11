import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContextProvider";
import type { PeriodoRange } from "../lib/periodo";

/**
 * Leitura unificada de lançamentos por tipo (F2 do roadmap ADR-029).
 * Substitui as queries espelhadas de Entradas.tsx e Saidas.tsx.
 */

const SELECT_LANCAMENTOS = `
  *,
  conta:conta_id(nome, id),
  categoria:categoria_id(nome, cor, id),
  subcategoria:subcategoria_id(nome),
  base_ministerial:base_ministerial_id(titulo),
  centro_custo:centro_custo_id(nome),
  fornecedor:fornecedor_id(nome, id),
  solicitacao_reembolso:solicitacao_reembolso_id(status)
`;

export function useLancamentos(tipo: "entrada" | "saida", periodo: PeriodoRange) {
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();

  const { data: transacoes, isLoading, refetch } = useQuery({
    queryKey: [
      tipo === "entrada" ? "entradas" : "saidas",
      igrejaId,
      filialId,
      isAllFiliais,
      periodo.inicio,
      periodo.fim,
    ],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("transacoes_financeiras")
        .select(SELECT_LANCAMENTOS)
        .eq("tipo", tipo)
        .eq("igreja_id", igrejaId)
        .gte("data_vencimento", periodo.inicio)
        .lte("data_vencimento", periodo.fim)
        .order("data_vencimento", { ascending: false });
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;

      // Exclui transações de reembolso que NÃO estão pagas (ADR-001)
      return (
        data?.filter(
          (t) =>
            !t.solicitacao_reembolso_id ||
            t.solicitacao_reembolso?.status === "pago",
        ) || []
      );
    },
    enabled: !loading && !!igrejaId,
  });

  return { transacoes, isLoading, refetch };
}

/** Cadastros de apoio para filtros (contas, categorias do tipo, fornecedores). */
export function useDadosFiltros(tipo: "entrada" | "saida") {
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();

  const enabled = !loading && !!igrejaId;
  const filialScope = !isAllFiliais && filialId ? filialId : null;

  const { data: contas } = useQuery({
    queryKey: ["contas-filtro", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      let query = supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId!)
        .order("nome");
      if (filialScope) query = query.eq("filial_id", filialScope);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled,
  });

  const { data: categorias } = useQuery({
    queryKey: ["categorias-filtro", tipo, igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      let query = supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("ativo", true)
        .eq("tipo", tipo)
        .eq("igreja_id", igrejaId!)
        .order("nome");
      if (filialScope) query = query.eq("filial_id", filialScope);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled,
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-filtro", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      let query = supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId!)
        .order("nome");
      if (filialScope) query = query.eq("filial_id", filialScope);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled,
  });

  return { contas, categorias, fornecedores };
}

/**
 * Mapa transacao_id → reconciliado a partir de extratos vinculados (1:1).
 * Antes só Saídas montava este mapa; unificado para os dois tipos.
 */
export function useConciliacaoMap(transacaoIds: string[]) {
  const { igrejaId, filialId, isAllFiliais, loading } = useAuthContext();
  const [conciliacaoMap, setConciliacaoMap] = useState<Map<string, boolean>>(
    new Map(),
  );

  const idsKey = useMemo(() => transacaoIds.join(","), [transacaoIds]);

  const { data: extratosConciliados = [] } = useQuery({
    queryKey: ["extratos-vinculados", igrejaId, filialId, isAllFiliais, idsKey],
    queryFn: async () => {
      if (!igrejaId || transacaoIds.length === 0) return [];
      let query = supabase
        .from("extratos_bancarios")
        .select("transacao_vinculada_id, reconciliado")
        .in("transacao_vinculada_id", transacaoIds)
        .eq("igreja_id", igrejaId);
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !loading && !!igrejaId && transacaoIds.length > 0,
  });

  useEffect(() => {
    const map = new Map<string, boolean>();
    extratosConciliados.forEach((extrato) => {
      if (extrato.transacao_vinculada_id) {
        map.set(extrato.transacao_vinculada_id, !!extrato.reconciliado);
      }
    });
    setConciliacaoMap((prev) => {
      if (map.size === prev.size) {
        let equal = true;
        for (const [key, value] of map) {
          if (prev.get(key) !== value) {
            equal = false;
            break;
          }
        }
        if (equal) return prev;
      }
      return map;
    });
  }, [extratosConciliados]);

  return conciliacaoMap;
}
