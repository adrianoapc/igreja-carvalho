import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContextProvider";

interface UserTimeEntry {
  time_id: string;
  role: "admin" | "lider" | "sublider" | "membro";
}

interface TimePermissionResult {
  /** Todos os times que o usuário tem vínculo, com o respectivo role */
  userTimes: UserTimeEntry[];
  /** Verifica se o usuário é admin/tecnico (bypass global) */
  isAdmin: boolean;
  /** IDs dos times visíveis */
  visibleTimeIds: string[];
  /** Retorna o role do usuário para um time específico */
  getTimeRole: (timeId: string) => "admin" | "lider" | "sublider" | "membro" | null;
  /** Pode editar escalas/membros do time */
  canEdit: (timeId: string) => boolean;
  /** Pode visualizar o time */
  canView: (timeId: string) => boolean;
  loading: boolean;
}

export function useTimePermission(): TimePermissionResult {
  const { profile, roles } = useAuthContext();
  const [userTimes, setUserTimes] = useState<UserTimeEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = roles.includes("admin") || roles.includes("tecnico");

  useEffect(() => {
    if (!profile?.id) {
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.rpc("get_user_times", {
          p_pessoa_id: profile.id,
        });

        if (error) {
          console.error("Erro ao carregar permissões de time:", error);
          setUserTimes([]);
        } else {
          setUserTimes(
            (data || []).map((d: any) => ({
              time_id: d.time_id,
              role: d.role as UserTimeEntry["role"],
            }))
          );
        }
      } catch (err) {
        console.error("Erro inesperado em useTimePermission:", err);
        setUserTimes([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [profile?.id, isAdmin]);

  const visibleTimeIds = userTimes.map((t) => t.time_id);

  const getTimeRole = useCallback(
    (timeId: string) => {
      const entry = userTimes.find((t) => t.time_id === timeId);
      return entry?.role ?? null;
    },
    [userTimes]
  );

  const canEdit = useCallback(
    (timeId: string) => {
      const role = getTimeRole(timeId);
      return role === "admin" || role === "lider" || role === "sublider";
    },
    [getTimeRole]
  );

  const canView = useCallback(
    (timeId: string) => {
      const role = getTimeRole(timeId);
      return role !== null;
    },
    [getTimeRole]
  );

  return {
    userTimes,
    isAdmin,
    visibleTimeIds,
    getTimeRole,
    canEdit,
    canView,
    loading,
  };
}
