import { useCallback } from "react";
import { useAuthContext } from "@/contexts/AuthContextProvider";

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

/**
 * Hook simplificado que consome dados do AuthContext
 * Mantém a mesma interface pública para retrocompatibilidade
 */
export function usePermissions() {
  const { roles, isAdmin, loading } = useAuthContext();

  // Função para verificar uma permissão específica
  const checkPermission = useCallback(
    async (perm: Permission): Promise<boolean> => {
      // Admin tem acesso a tudo
      if (isAdmin) return true;

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
    },
    [roles, isAdmin]
  );

  return {
    checkPermission,
    isAdmin,
    loading,
  };
}
