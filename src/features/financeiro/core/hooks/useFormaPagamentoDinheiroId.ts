import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "@/hooks/useFilialId";

/**
 * Resolve o id da forma de pagamento "Dinheiro" da igreja atual — usado por
 * `isPagamentoDinheiro` (ADR-029: forma_pagamento_id é FK real, não mais
 * substring match em texto solto).
 */
export function useFormaPagamentoDinheiroId() {
  const { igrejaId } = useFilialId();

  const { data } = useQuery({
    queryKey: ["forma-pagamento-dinheiro-id", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return null;
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("id")
        .eq("igreja_id", igrejaId)
        .ilike("nome", "dinheiro")
        .eq("ativo", true)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
    enabled: !!igrejaId,
    staleTime: 5 * 60 * 1000,
  });

  return data ?? null;
}
