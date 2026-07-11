import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContextProvider";

/**
 * Cadastros de apoio do formulário de lançamento (contas, categorias,
 * subcategorias, centros de custo, bases ministeriais, fornecedores e
 * formas de pagamento) — extraído do TransacaoDialog (F2/ADR-029 §7.3).
 *
 * Mantém as mesmas queryKeys do dialog original para preservar o cache.
 */
export function useDadosApoio(
  tipo: "entrada" | "saida",
  categoriaId: string,
  open: boolean,
) {
  const { igrejaId, filialId, isAllFiliais } = useAuthContext();

  const { data: contas } = useQuery({
    queryKey: ["contas-select", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      let query = supabase
        .from("contas")
        .select("id, nome")
        .eq("ativo", true)
        .eq("igreja_id", igrejaId)
        .order("nome");
      if (!isAllFiliais && filialId) {
        query = query.eq("filial_id", filialId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId,
  });

  const { data: categorias } = useQuery({
    queryKey: ["categorias-select", tipo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, nome")
        .eq("tipo", tipo)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: subcategorias, isLoading: subcategoriasLoading } = useQuery({
    queryKey: ["subcategorias-select", categoriaId, open],
    queryFn: async () => {
      if (!categoriaId || categoriaId === "none") return [];
      const { data, error } = await supabase
        .from("subcategorias_financeiras")
        .select("id, nome")
        .eq("categoria_id", categoriaId)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
    enabled: open && !!categoriaId && categoriaId !== "none",
    staleTime: 0,
  });

  const { data: centros } = useQuery({
    queryKey: ["centros-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_custo")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: bases } = useQuery({
    queryKey: ["bases-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bases_ministeriais")
        .select("id, titulo")
        .eq("ativo", true)
        .order("titulo");
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fornecedores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: formasPagamento } = useQuery({
    queryKey: ["formas-pagamento-select"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data;
    },
  });

  return {
    contas,
    categorias,
    subcategorias,
    subcategoriasLoading,
    centros,
    bases,
    fornecedores,
    formasPagamento,
  };
}
