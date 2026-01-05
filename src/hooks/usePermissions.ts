import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { useIgrejaId } from "./useIgrejaId";
import { supabase } from "@/integrations/supabase/client";

// Lista de permissões conhecidas (baseado no teu SQL)
export type Permission =
  | "financeiro.view"
  | "financeiro.admin"
  | "gabinete.view"
  | "gabinete.admin"
  | "pessoas.view"
  | "pessoas.admin"
  | "ministerio.view"
  | "configuracoes.view"
  | "ensino.view"
  | "filiais.view"
  | "filiais.manage";

export function usePermissions() {
  const { user, loading: authLoading } = useAuth();
  const { igrejaId, loading: igrejaLoading } = useIgrejaId();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Cache para evitar chamadas repetidas
  const [permissionsCache, setPermissionsCache] = useState<
    Record<string, boolean>
  >({});

  // 1. Verifica se é Admin Global (Superusuário)
  const checkAdminStatus = useCallback(async () => {
    // Sem usuário ou igreja, não temos como validar permissões; finalize carregamento
    if (!user || !igrejaId) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("igreja_id", igrejaId);

      if (
        !error &&
        data &&
        data.some(
          (r) =>
            r.role === "admin" ||
            r.role === "super_admin" ||
            r.role === "admin_igreja"
        )
      ) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error("Erro ao verificar admin:", error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  }, [user, igrejaId]);

  useEffect(() => {
    if (!authLoading && !igrejaLoading) {
      if (user) {
        checkAdminStatus();
      } else {
        setIsAdmin(false);
        setLoading(false);
      }
    }
  }, [user, authLoading, igrejaLoading, checkAdminStatus]);

  // 2. Função para verificar uma permissão específica no Banco
  const checkPermission = useCallback(
    async (perm: Permission): Promise<boolean> => {
      if (!user || !igrejaId) return false;
      if (isAdmin) return true; // Admin tem acesso a tudo

      // TEMPORÁRIO: Lógica simplificada até implementar o sistema completo de permissões
      // Por enquanto, permite acesso baseado em roles básicas
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("igreja_id", igrejaId);

        if (error) {
          console.error(`Erro ao verificar permissão ${perm}:`, error);
          return false;
        }

        const roles = (data || []).map((r) => r.role);

        // Lógica básica de permissões baseada em roles
        switch (perm) {
          case "financeiro.view":
          case "financeiro.admin":
            return roles.includes("admin") || roles.includes("tesoureiro");
          case "gabinete.view":
          case "gabinete.admin":
            return roles.includes("admin") || roles.includes("pastor");
          case "pessoas.view":
          case "pessoas.admin":
            return roles.includes("admin") || roles.includes("secretario");
          case "ministerio.view":
            return (
              roles.includes("admin") ||
              roles.includes("pastor") ||
              roles.includes("lider")
            );
          case "configuracoes.view":
            return roles.includes("admin");
          case "ensino.view":
            return roles.includes("admin") || roles.includes("lider");
          case "filiais.view":
          case "filiais.manage":
            return roles.includes("admin");
          default:
            return false;
        }
      } catch (error) {
        console.error(`Erro ao verificar permissão ${perm}:`, error);
        return false;
      }
    },
    [user, igrejaId, isAdmin]
  );

  return {
    checkPermission,
    isAdmin,
    loading: loading || authLoading || igrejaLoading,
  };
}
