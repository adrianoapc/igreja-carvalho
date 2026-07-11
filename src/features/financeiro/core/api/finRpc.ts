import { supabase } from "@/integrations/supabase/client";

/**
 * Chamador interno das RPCs canônicas fin_* (ADR-029).
 *
 * As funções fin_* ainda não constam nos tipos gerados de
 * `src/integrations/supabase/types.ts` (regenerar com `supabase gen types`
 * após o deploy das migrations); este é o único ponto do domínio com cast.
 */

export interface FinResultado {
  ok: boolean;
  id?: string;
  ids?: string[];
  warnings?: string[];
  [key: string]: unknown;
}

export async function callFinRpc(
  fn: string,
  params: Record<string, unknown>,
): Promise<FinResultado> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)(fn, params);
  if (error) throw error;
  return data as FinResultado;
}
