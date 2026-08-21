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

  // Espelha EXATAMENTE o conjunto de roles que public.has_role(uid, 'admin')
  // aceita no backend — admin, admin_igreja, admin_filial (ver função SQL).
  // Deliberadamente NÃO usa isAdmin genérico (admin/super_admin, calculado em
  // get_user_auth_context): has_role('admin') não dá tratamento especial a
  // super_admin, só a admin_igreja/admin_filial — um super_admin sem a role
  // literal "admin" passaria isAdmin mas falharia a policy (visto em review:
  // botão apareceria, RLS negaria, count=0). Se algum dia um super_admin
  // também tiver a role "admin" atribuída, já passa por roles.includes.
  // Usar pra gates de UI de ações destrutivas atrás de policies
  // has_role(admin) — ex.: hard-delete de profiles/fornecedores.
  const isAdminOrScopedAdmin =
    roles.includes("admin") ||
    roles.includes("admin_igreja") ||
    roles.includes("admin_filial");

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
