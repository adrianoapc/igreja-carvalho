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
  | "filiais.manage"
  | "eventos.view"
  | "eventos.admin"
  | "cultos.view"
  | "cultos.admin";

/**
 * Hook simplificado que consome dados do AuthContext
 * Mantém a mesma interface pública para retrocompatibilidade
 */
export function usePermissions() {
  const { roles, isAdmin, loading } = useAuthContext();

  // Mesmo conjunto de roles que public.has_role(uid, 'admin') aceita no
  // backend (admin, admin_igreja, admin_filial — ver função SQL), somado a
  // isAdmin (admin/super_admin, calculado em get_user_auth_context). Usar
  // pra gates de UI de ações destrutivas que dependem de RLS com
  // has_role(admin) — ex.: hard-delete de profiles/fornecedores — pra não
  // esconder o botão de um admin_igreja/admin_filial que a policy already
  // deixaria passar (achado de review: isAdmin sozinho é mais estreito que
  // has_role('admin') nesses casos).
  const isAdminOrScopedAdmin =
    isAdmin || roles.includes("admin_igreja") || roles.includes("admin_filial");

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
        case "eventos.view":
        case "eventos.admin":
          return (
            roles.includes("admin") ||
            roles.includes("pastor") ||
            roles.includes("lider")
          );
        case "cultos.view":
        case "cultos.admin":
          return (
            roles.includes("admin") ||
            roles.includes("pastor") ||
            roles.includes("lider")
          );
        default:
          return false;
      }
    },
    [roles, isAdmin]
  );

  return {
    checkPermission,
    isAdmin,
    isAdminOrScopedAdmin,
    loading,
  };
}
