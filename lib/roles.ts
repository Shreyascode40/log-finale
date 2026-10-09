/**
 * Pure role helpers. No Node-only imports, so this module is safe to use from
 * `middleware.ts` (edge runtime) as well as from server actions.
 */
import { ROLES, type Role } from "./constants";

export { ROLES };
export type { Role };

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Where each role lands after login. */
export function homeForRole(role: string | null | undefined): string {
  switch (role) {
    case "STUDENT":
      return "/student";
    case "GUIDE":
      return "/guide";
    case "HOD":
      return "/hod";
    default:
      return "/login";
  }
}

/** Route prefixes each role may open. */
const ROLE_PREFIX: Record<Role, string> = {
  STUDENT: "/student",
  GUIDE: "/guide",
  HOD: "/hod",
};

/** True when `role` is allowed to open `pathname`. */
export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  if (!isRole(role)) return false;
  const prefix = ROLE_PREFIX[role];
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Routes under middleware protection. */
export const PROTECTED_PREFIXES = ["/student", "/guide", "/hod"] as const;
