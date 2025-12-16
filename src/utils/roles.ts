/**
 * Constantes e utilidades para gerenciamento de roles de usuário
 */

export const ROLES = {
  ADMIN: 'admin',
  TECNICO: 'tecnico',
  LIDER: 'lider',
  MEMBRO: 'membro',
  VISITANTE: 'visitante',
} as const;

export type UserRole = (typeof ROLES)[keyof typeof ROLES];

// Roles com privilégios administrativos
export const ADMIN_ROLES: UserRole[] = [ROLES.ADMIN, ROLES.TECNICO];

// Roles com acesso ao sistema interno
export const INTERNAL_ROLES: UserRole[] = [
  ROLES.ADMIN,
  ROLES.TECNICO,
  ROLES.LIDER,
  ROLES.MEMBRO,
];

/**
 * Verifica se o usuário tem permissão de admin
 */
export function isAdmin(userRole?: string | null): boolean {
  if (!userRole) return false;
  return ADMIN_ROLES.includes(userRole as UserRole);
}

/**
 * Verifica se o usuário tem permissão de técnico
 */
export function isTecnico(userRole?: string | null): boolean {
  return userRole === ROLES.TECNICO;
}

/**
 * Verifica se o usuário tem permissão específica
 * Admin e Técnico têm acesso total
 */
export function hasPermission(
  userRole?: string | null,
  requiredRole?: UserRole
): boolean {
  if (!userRole) return false;
  
  // Admin e Técnico têm acesso total
  if (isAdmin(userRole)) return true;
  
  // Verifica role específica
  if (requiredRole) {
    return userRole === requiredRole;
  }
  
  return false;
}

/**
 * Verifica se o usuário tem acesso interno ao sistema
 */
export function hasInternalAccess(userRole?: string | null): boolean {
  if (!userRole) return false;
  return INTERNAL_ROLES.includes(userRole as UserRole);
}

/**
 * Verifica se o usuário pode acessar durante manutenção
 */
export function canAccessDuringMaintenance(userRole?: string | null): boolean {
  return isAdmin(userRole);
}
