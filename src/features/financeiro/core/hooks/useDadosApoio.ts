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
        // Conta compartilhada (filial_id NULL) é visível de qualquer filial
        // (RLS via has_filial_access) — eq() sozinho a excluiria.
        query = query.or(`filial_id.eq.${filialId},filial_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId,
  });

  // TransacaoDialog manda filial_id: null pro lançamento sempre que
  // isAllFiliais (nenhum seletor de filial por-lançamento existe nesse
  // modo — ver TransacaoDialog.tsx) — então os 6 campos de catálogo
  // filial-scoped abaixo (categoria/subcategoria/centro_custo/base/
  // fornecedor/forma_pagamento) só podem ser GLOBAIS nesse modo, senão
  // fin_validar_fk_filial rejeita (filial efetiva NULL != filial do
  // recurso). `!isAllFiliais && filialId` deixava isAllFiliais SEM filtro
  // nenhum (mostrava opções de QUALQUER filial, não só globais) — a UI
  // oferecia exatamente a escolha que o backend ia recusar (achado do
  // /code-review). Sempre filtra: `isAllFiliais` → só globais; filial
  // específica → própria ou global; nem um nem outro (single-filial) →
  // sem filtro, como antes.
  const filtrarPorFilialCatalogo = <T,>(query: T): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = query as any;
    if (isAllFiliais) return q.is("filial_id", null);
    if (filialId) return q.or(`filial_id.eq.${filialId},filial_id.is.null`);
    return q;
  };

  const { data: categorias } = useQuery({
    queryKey: ["categorias-select", tipo, filialId, isAllFiliais],
    queryFn: async () => {
      const query = filtrarPorFilialCatalogo(
        supabase
          .from("categorias_financeiras")
          .select("id, nome")
          .eq("tipo", tipo)
          .eq("ativo", true)
          .order("nome"),
      );
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: subcategorias, isLoading: subcategoriasLoading } = useQuery({
    queryKey: ["subcategorias-select", categoriaId, open, filialId, isAllFiliais],
    queryFn: async () => {
      if (!categoriaId || categoriaId === "none") return [];
      const query = filtrarPorFilialCatalogo(
        supabase
          .from("subcategorias_financeiras")
          .select("id, nome")
          .eq("categoria_id", categoriaId)
          .eq("ativo", true)
          .order("nome"),
      );
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: open && !!categoriaId && categoriaId !== "none",
    staleTime: 0,
  });

  const { data: centros } = useQuery({
    queryKey: ["centros-select", filialId, isAllFiliais],
    queryFn: async () => {
      const query = filtrarPorFilialCatalogo(
        supabase.from("centros_custo").select("id, nome").eq("ativo", true).order("nome"),
      );
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: bases } = useQuery({
    queryKey: ["bases-select", filialId, isAllFiliais],
    queryFn: async () => {
      const query = filtrarPorFilialCatalogo(
        supabase.from("bases_ministeriais").select("id, titulo").eq("ativo", true).order("titulo"),
      );
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores-select", filialId, isAllFiliais],
    queryFn: async () => {
      const query = filtrarPorFilialCatalogo(
        supabase.from("fornecedores").select("id, nome").eq("ativo", true).order("nome"),
      );
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: formasPagamento } = useQuery({
    queryKey: ["formas-pagamento-select", igrejaId, filialId, isAllFiliais],
    queryFn: async () => {
      if (!igrejaId) return [];
      const query = filtrarPorFilialCatalogo(
        supabase
          .from("formas_pagamento")
          .select("id, nome")
          .eq("ativo", true)
          .eq("igreja_id", igrejaId)
          .order("nome"),
      );
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!igrejaId,
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
