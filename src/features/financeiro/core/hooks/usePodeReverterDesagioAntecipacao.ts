import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContextProvider";

/**
 * UX only — o banco recusa de verdade (`_fin_exigir_autorizado_lancar_despesas`).
 *
 * `fin_resolver_contexto(..., 'autorizado_lancar_despesas')` só vale no canal
 * bot (ADR-029). No JWT, tesoureiro sem o flag ainda passava no papel. Admin
 * / super_admin têm bypass de papel, igual ao helper SQL (Codex #102 P1).
 */
export function usePodeReverterDesagioAntecipacao(): boolean {
  const { user, roles, isAdmin } = useAuthContext();
  const precisaFlag =
    !isAdmin && !roles.includes("super_admin") && roles.includes("tesoureiro");

  const { data: autorizado } = useQuery({
    queryKey: ["profile-autorizado-lancar-despesas", user?.id],
    enabled: !!user?.id && precisaFlag,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("autorizado_lancar_despesas")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return !!data?.autorizado_lancar_despesas;
    },
  });

  if (isAdmin || roles.includes("super_admin")) return true;
  return precisaFlag && autorizado === true;
}
