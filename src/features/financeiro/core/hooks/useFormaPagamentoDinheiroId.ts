import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilialId } from "@/hooks/useFilialId";

const FORMA_DINHEIRO_VAZIA: ReadonlySet<string> = new Set();

/**
 * Resolve os ids de TODAS as formas de pagamento "Dinheiro" da igreja
 * atual — usado por `isPagamentoDinheiro` (ADR-029: forma_pagamento_id é
 * FK real, não mais substring match em texto solto). `formas_pagamento`
 * pode ter uma linha "Dinheiro" por filial (filial_id não-nulo) além de uma
 * global; resolver só a mais antiga (versão anterior, `.limit(1)`) fazia
 * `isPagamentoDinheiro` nunca bater pras filiais cuja "Dinheiro" não fosse
 * essa — achado do /code-review, PR #67.
 */
export function useFormaPagamentoDinheiroId() {
  const { igrejaId } = useFilialId();

  const { data } = useQuery({
    queryKey: ["forma-pagamento-dinheiro-ids", igrejaId],
    queryFn: async () => {
      if (!igrejaId) return [];
      // Sem filtro de ativo=true: isto é detecção de transações HISTÓRICAS
      // que já apontam pra uma forma "Dinheiro" (podendo ter sido
      // desativada depois), não seleção de forma pra transação NOVA — uma
      // forma desativada continua sendo Dinheiro pras transações que já a
      // referenciam, e isPagamentoDinheiro só cai pro fallback de texto
      // quando o id é nulo, nunca quando é um id não reconhecido (achado do
      // /code-review).
      const { data, error } = await supabase
        .from("formas_pagamento")
        .select("id")
        .eq("igreja_id", igrejaId)
        .ilike("nome", "dinheiro");
      if (error) throw error;
      return (data ?? []).map((f) => f.id);
    },
    enabled: !!igrejaId,
    staleTime: 5 * 60 * 1000,
  });

  return useMemo(
    () => (data && data.length > 0 ? new Set(data) : FORMA_DINHEIRO_VAZIA),
    [data],
  );
}
