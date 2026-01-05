import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FilialAccess {
  id: string;
  filial_id: string;
  can_view: boolean;
  can_edit: boolean;
}

export function useUserFilialAccess(targetUserId?: string, igrejaId?: string) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const userId = targetUserId || session?.user?.id;

  // Buscar acessos do usuário
  const { data: userAccess, isLoading } = useQuery({
    queryKey: ["user-filial-access", userId, igrejaId],
    queryFn: async () => {
      if (!userId || !igrejaId) return [];

      const { data, error } = await supabase
        .from("user_filial_access")
        .select("id, filial_id, can_view, can_edit")
        .eq("user_id", userId)
        .eq("igreja_id", igrejaId);

      if (error) throw error;
      return (data || []) as FilialAccess[];
    },
    enabled: !!userId && !!igrejaId,
  });

  // IDs das filiais permitidas
  const allowedFilialIds = userAccess?.filter(a => a.can_view).map(a => a.filial_id) || [];
  const hasExplicitRestrictions = (userAccess?.length ?? 0) > 0;

  // Conceder acesso
  const grantAccess = useMutation({
    mutationFn: async ({ filialId, canView = true, canEdit = false }: { filialId: string; canView?: boolean; canEdit?: boolean }) => {
      if (!userId || !igrejaId) throw new Error("Usuário ou igreja não identificados");

      const { error } = await supabase
        .from("user_filial_access")
        .upsert({
          user_id: userId,
          filial_id: filialId,
          igreja_id: igrejaId,
          can_view: canView,
          can_edit: canEdit,
          granted_by: session?.user?.id,
        }, { onConflict: "user_id,filial_id" });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-filial-access", userId, igrejaId] });
    },
    onError: (error) => {
      toast.error("Erro ao conceder acesso: " + error.message);
    },
  });

  // Revogar acesso
  const revokeAccess = useMutation({
    mutationFn: async (filialId: string) => {
      if (!userId || !igrejaId) throw new Error("Usuário ou igreja não identificados");

      const { error } = await supabase
        .from("user_filial_access")
        .delete()
        .eq("user_id", userId)
        .eq("filial_id", filialId)
        .eq("igreja_id", igrejaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-filial-access", userId, igrejaId] });
    },
    onError: (error) => {
      toast.error("Erro ao revogar acesso: " + error.message);
    },
  });

  // Limpar todas as restrições (dar acesso total)
  const clearAllRestrictions = useMutation({
    mutationFn: async () => {
      if (!userId || !igrejaId) throw new Error("Usuário ou igreja não identificados");

      const { error } = await supabase
        .from("user_filial_access")
        .delete()
        .eq("user_id", userId)
        .eq("igreja_id", igrejaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-filial-access", userId, igrejaId] });
      toast.success("Restrições removidas - usuário tem acesso a todas as filiais");
    },
    onError: (error) => {
      toast.error("Erro ao limpar restrições: " + error.message);
    },
  });

  return {
    userAccess,
    allowedFilialIds,
    hasExplicitRestrictions,
    isLoading,
    grantAccess,
    revokeAccess,
    clearAllRestrictions,
  };
}

// Hook para buscar acesso do usuário atual (para FilialSwitcher)
export function useCurrentUserFilialAccess(igrejaId?: string) {
  const { session } = useAuth();
  const userId = session?.user?.id;

  const { data: allowedFilialIds, isLoading } = useQuery({
    queryKey: ["current-user-filial-access", userId, igrejaId],
    queryFn: async () => {
      if (!userId || !igrejaId) return null;

      const { data, error } = await supabase
        .from("user_filial_access")
        .select("filial_id")
        .eq("user_id", userId)
        .eq("igreja_id", igrejaId)
        .eq("can_view", true);

      if (error) {
        console.error("Erro ao buscar acessos de filial:", error);
        return null;
      }

      // Se não há entradas, retorna null (sem restrições)
      if (!data || data.length === 0) return null;

      return data.map(r => r.filial_id);
    },
    enabled: !!userId && !!igrejaId,
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });

  return {
    allowedFilialIds,
    hasExplicitRestrictions: allowedFilialIds !== null,
    isLoading,
  };
}
