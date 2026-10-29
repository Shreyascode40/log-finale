import "server-only";

import type { Prisma } from "@prisma/client";
import { backendApi } from "@/lib/backend-api";
import type { Role } from "@/lib/roles";

const studentGroupInfoArgs = {
  include: {
    group: {
      include: {
        guide: { select: { name: true } },
        members: { orderBy: { createdAt: "asc" } },
      },
    },
  },
} satisfies Prisma.GroupMemberFindFirstArgs;

type StudentGroupInfo = Prisma.GroupMemberGetPayload<typeof studentGroupInfoArgs>;
export type GroupInfoActor = { id: string; role: Role };

/** Read helper used by the student's cover, members, rules and undertaking sheets. */
export async function getStudentGroupInfo(userId: string) {
  const membership = await backendApi<StudentGroupInfo | null>("/v1/student/group-info");
  if (!membership || membership.userId !== userId) return null;

  // JSON transport serializes Prisma dates to strings; restore the date shape
  // expected by existing server-rendered sheets.
  return {
    ...membership,
    createdAt: new Date(membership.createdAt),
    group: {
      ...membership.group,
      createdAt: new Date(membership.group.createdAt),
      members: membership.group.members.map((member) => ({
        ...member,
        createdAt: new Date(member.createdAt),
        rulesAckAt: member.rulesAckAt ? new Date(member.rulesAckAt) : null,
        undertakingAcceptedAt: member.undertakingAcceptedAt ? new Date(member.undertakingAcceptedAt) : null,
      })),
    },
  };
}

export function updateCover(_actor: GroupInfoActor, input: unknown) {
  return backendApi<{ success: true }>("/v1/student/group-info/cover", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateMember(_actor: GroupInfoActor, input: unknown) {
  return backendApi<{ success: true }>("/v1/student/group-info/member", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateMemberPhoto(_actor: GroupInfoActor, memberId: string, file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return backendApi<{ url: string }>(
    `/v1/student/group-info/members/${encodeURIComponent(memberId)}/photo`,
    {
      method: "PUT",
      headers: { "content-type": file.type },
      body: bytes,
    },
  );
}

export async function getGroupInfoById(groupId: string) {
  const group = await backendApi<{
    id: string;
    groupNo: string | null;
    projectTitle: string | null;
    area: string | null;
    academicYear: string | null;
    department: string | null;
    status: string;
    guideId: string | null;
    isSponsored: boolean;
    createdAt: string;
    guide: { name: string } | null;
    members: Array<{
      id: string;
      userId: string;
      name: string | null;
      rollNo: string | null;
      mobile: string | null;
      email: string | null;
      teResult: string | null;
      examSeatNo: string | null;
      contribution: string | null;
      photoUrl: string | null;
      memberType: string;
      createdAt: string;
      rulesAckAt: string | null;
      undertakingAcceptedAt: string | null;
    }>;
  }>(`/v1/groups/${encodeURIComponent(groupId)}/info`);

  return {
    ...group,
    createdAt: new Date(group.createdAt),
    members: group.members.map((member) => ({
      ...member,
      createdAt: new Date(member.createdAt),
      rulesAckAt: member.rulesAckAt ? new Date(member.rulesAckAt) : null,
      undertakingAcceptedAt: member.undertakingAcceptedAt ? new Date(member.undertakingAcceptedAt) : null,
    })),
  };
}
