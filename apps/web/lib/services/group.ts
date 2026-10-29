import "server-only";

import { backendApi } from "@/lib/backend-api";
import type { Role } from "@/lib/roles";

/** Identity shape retained for the server action boundary. Authorization and
 * group mutations are performed by the Render API using its database state. */
export type GroupActor = {
  id: string;
  role: Role;
  email: string;
  rollNo: string | null;
};

export async function createGroup(_actor: GroupActor, input: unknown) {
  return backendApi<{ groupId: string; code: string }>("/v1/groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function inviteMember(_actor: GroupActor, input: unknown) {
  return backendApi<{ inviteId: string; code: string }>("/v1/groups/invites", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function acceptInvite(_actor: GroupActor, input: unknown) {
  return backendApi<{ groupId: string }>("/v1/groups/invites/accept", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function declineInvite(_actor: GroupActor, input: unknown) {
  await backendApi<{ success: true }>("/v1/groups/invites/decline", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function joinByCode(_actor: GroupActor, input: unknown) {
  return backendApi<{ groupId: string }>("/v1/groups/join-by-code", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function removeMember(_actor: GroupActor, input: unknown) {
  const body = input as { memberId?: unknown } | null;
  if (typeof body?.memberId !== "string") throw new Error("Invalid member.");
  await backendApi<{ success: true }>(
    `/v1/groups/members/${encodeURIComponent(body.memberId)}`,
    { method: "DELETE" },
  );
}

export async function submitGroup(_actor: GroupActor, input: unknown) {
  await backendApi<{ success: true }>("/v1/groups/submit", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getStudentGroupOnboarding() {
  return backendApi<{
    membership: {
      id: string;
      userId: string;
      groupId: string;
      group: {
        id: string;
        code: string | null;
        groupNo: string | null;
        projectTitle: string | null;
        area: string | null;
        academicYear: string | null;
        department: string | null;
        status: string;
        rejectReason: string | null;
        creatorId: string | null;
        guide: { name: string } | null;
        members: Array<{
          id: string;
          userId: string;
          name: string | null;
          rollNo: string | null;
          mobile: string | null;
          email: string | null;
          memberType: string;
          createdAt: string;
        }>;
        invites: Array<{
          id: string;
          invitedEmail: string | null;
          invitedRollNo: string | null;
          code: string | null;
          status: string;
          expiresAt: string;
          createdAt: string;
        }>;
      };
    } | null;
    received: Array<{
      id: string;
      code: string | null;
      createdAt: string;
      expiresAt: string;
      group: {
        groupNo: string | null;
        projectTitle: string | null;
        code: string | null;
      };
    }>;
  }>("/v1/groups/onboarding");
}
