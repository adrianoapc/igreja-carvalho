import {
  useInfiniteQuery,
  UseInfiniteQueryResult,
} from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 50; // Registros por página

export interface UsePaginatedQueryOptions {
  table: string;
  select: string;
  filters?: Record<string, unknown>;
  orderBy?: {
    column: string;
    ascending?: boolean;
  };
  igrejaId: string | null;
  filialId: string | null;
  isAllFiliais: boolean;
  pageSize?: number;
  enabled?: boolean;
}

/**
 * Hook universal para queries paginadas com suporte a multi-filial
 *
 * Características:
 * - Paginação automática (50 registros por página)
 * - Suporte completo a multi-filial (isAllFiliais)
 * - Cache gerenciado pelo React Query
 * - Retry automático com exponential backoff
 * - Deduplicação de queries
 */
export function useFilialPaginatedQuery(
  options: UsePaginatedQueryOptions
): UseInfiniteQueryResult<Array<Record<string, unknown>>, Error> {
  const {
    table,
    select,
    filters = {},
    orderBy,
    igrejaId,
    filialId,
    isAllFiliais,
    pageSize = PAGE_SIZE,
    enabled = true,
  } = options;

  return useInfiniteQuery({
    queryKey: [
      `${table}-paginated`,
      igrejaId,
      filialId,
      isAllFiliais,
      JSON.stringify(filters),
      JSON.stringify(orderBy),
    ],
    queryFn: async ({ pageParam = 0 }) => {
      if (!igrejaId) return [];

      // Construir query - usar type assertion para contornar tipagem excessiva do Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query = supabase.from(table as any).select(select) as any;
      let q = query;

      // Sempre filtrar por igreja
      q = q.eq("igreja_id", igrejaId);

      // Filtrar por filial se especificado (não é multi-filial)
      if (!isAllFiliais && filialId) {
        q = q.eq("filial_id", filialId);
      }

      // Aplicar filtros customizados (ignorar undefined/null)
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          q = q.eq(key, value);
        }
      });

      // Aplicar ordenação
      if (orderBy) {
        q = q.order(orderBy.column, {
          ascending: orderBy.ascending ?? true,
          nullsFirst: false,
        });
      }

      // Paginação: range(from, to) inclusive
      const from = (pageParam as number) * pageSize;
      const to = from + pageSize - 1;
      q = q.range(from, to);

      const { data, error } = await q;

      if (error) {
        console.error(`Error fetching ${table}:`, error);
        throw error;
      }

      return (data || []) as Array<Record<string, unknown>>;
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      // Se retornou menos registros que o page size, não há próxima página
      if ((lastPage as Array<Record<string, unknown>>).length < pageSize) {
        return undefined;
      }
      return (lastPageParam as number) + 1;
    },
    enabled: !!igrejaId && enabled,
    staleTime: 1000 * 60 * 5, // 5 minutos
    gcTime: 1000 * 60 * 10, // 10 minutos
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  }) as UseInfiniteQueryResult<Array<Record<string, unknown>>, Error>;
}

/**
 * Utility para extrair dados planos de uma resposta paginada
 */
export function flattenPaginatedData(
  pages: Array<Array<Record<string, unknown>>>
): Array<Record<string, unknown>> {
  return pages.flat();
}

/**
 * Utility para verificar se há mais dados a carregar
 */
export function hasMoreData(
  lastPageLength: number,
  pageSize: number = PAGE_SIZE
): boolean {
  return lastPageLength >= pageSize;
}

/**
 * Utility para contar total de itens carregados
 */
export function getTotalLoadedCount(
  pages: Array<Array<Record<string, unknown>>>
): number {
  return pages.flat().length;
}
