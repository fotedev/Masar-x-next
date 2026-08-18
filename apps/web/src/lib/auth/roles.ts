/**
 * Centralized admin role definitions.
 * Use isAdminRole() everywhere instead of inline role comparisons.
 */
export const ADMIN_ROLES = ['admin', 'doctor', 'student_admin'] as const;
export type AdminRole = typeof ADMIN_ROLES[number];

export function isAdminRole(role: string | undefined | null): role is AdminRole {
  return ADMIN_ROLES.includes(role as AdminRole);
}
