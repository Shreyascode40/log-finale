import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { homeForRole, isRole, type Role } from "@/lib/roles";

/**
 * Server-side permission checks. Every action and route calls into this module;
 * the UI hiding a button is never the enforcement point (master prompt).
 */

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: Role;
};

/** Minimal shape of a group the permission checks need. */
export type GroupLike = {
  guideId: string | null;
  creatorId?: string | null;
  members?: { userId: string }[];
  pdfPermission?: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user;
  if (!user?.id || !isRole(user.role)) return null;
  return {
    id: user.id,
    name: user.name ?? "",
    email: user.email ?? "",
    role: user.role,
  };
}

/** Requires any logged-in user, otherwise redirects to /login. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Requires one of `roles`, otherwise sends the user to their own home. */
export async function requireRole(roles: Role | Role[]): Promise<CurrentUser> {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = await requireUser();
  if (!allowed.includes(user.role)) redirect(homeForRole(user.role));
  return user;
}

export function isMemberOf(user: CurrentUser, group: GroupLike): boolean {
  return Boolean(group.members?.some((m) => m.userId === user.id));
}

/** Students on the group, the assigned guide, and the HOD can view the group. */
export function canViewGroup(user: CurrentUser, group: GroupLike): boolean {
  if (user.role === "HOD") return true;
  if (user.role === "GUIDE") return group.guideId === user.id;
  return isMemberOf(user, group);
}

/** Students on the group may edit cover info, undertaking and topic text. */
export function canEditGroupInfo(user: CurrentUser, group: GroupLike): boolean {
  return user.role === "STUDENT" && isMemberOf(user, group);
}

/** Only the guide assigned to THIS group may write marks / topic scores. */
export function canEnterMarks(user: CurrentUser, group: GroupLike): boolean {
  return user.role === "GUIDE" && group.guideId === user.id;
}

/** The assigned guide or the HOD may approve submitted marks. */
export function canApproveMarks(user: CurrentUser, group: GroupLike): boolean {
  return canEnterMarks(user, group) || user.role === "HOD";
}

/** Only the HOD may unlock approved marks (a reason is mandatory). */
export function canUnlockMarks(user: CurrentUser): boolean {
  return user.role === "HOD";
}

export function canAssignGuide(user: CurrentUser): boolean {
  return user.role === "HOD";
}

export function canTogglePdfPermission(user: CurrentUser): boolean {
  return user.role === "HOD";
}

export function canApproveTopic(user: CurrentUser): boolean {
  return user.role === "HOD";
}

/** HOD-only administration helpers (F3). */
export function canManageUsers(user: CurrentUser): boolean {
  return user.role === "HOD";
}

export function canApproveGroup(user: CurrentUser): boolean {
  return user.role === "HOD";
}

/** A group is active when the HOD has approved it AND a guide is assigned. */
export function isGroupActive(group: { status: string; guideId: string | null }): boolean {
  return group.status === "ACTIVE" && Boolean(group.guideId);
}

/**
 * PDF gate (master prompt rule 5):
 *   canGeneratePdf = pdfPermission === true AND allSectionsComplete === true
 * A student of the group or the HOD may generate it — but only when the gate is
 * open. The server re-checks this at generation time (F16).
 */
export function canGeneratePdf(
  user: CurrentUser,
  group: GroupLike,
  allSectionsComplete: boolean,
): boolean {
  const permitted = user.role === "HOD" || isMemberOf(user, group);
  return permitted && group.pdfPermission === true && allSectionsComplete === true;
}
