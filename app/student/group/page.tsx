import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import {
  GroupOnboarding,
  type GroupView,
  type ReceivedInvite,
} from "@/components/student/group-onboarding";

export const metadata = { title: "My group — Digital BE Log Book" };

export default async function StudentGroupPage() {
  const user = await requireRole("STUDENT");

  const userRow = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { email: true, rollNo: true },
  });

  const [membership, received] = await Promise.all([
    prisma.groupMember.findFirst({
      where: { userId: user.id },
      include: {
        group: {
          include: {
            guide: { select: { name: true } },
            members: { orderBy: { createdAt: "asc" } },
            invites: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } },
          },
        },
      },
    }),
    prisma.groupInvite.findMany({
      where: {
        status: "PENDING",
        expiresAt: { gt: new Date() },
        OR: [
          { invitedEmail: userRow.email },
          ...(userRow.rollNo ? [{ invitedRollNo: userRow.rollNo }] : []),
        ],
      },
      include: { group: { select: { groupNo: true, projectTitle: true, code: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const group: GroupView | null = membership
    ? {
        id: membership.group.id,
        code: membership.group.code,
        groupNo: membership.group.groupNo,
        projectTitle: membership.group.projectTitle,
        area: membership.group.area,
        academicYear: membership.group.academicYear,
        department: membership.group.department,
        status: membership.group.status,
        rejectReason: membership.group.rejectReason,
        guideName: membership.group.guide?.name ?? null,
        creatorId: membership.group.creatorId,
        myUserId: user.id,
        members: membership.group.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          name: member.name,
          rollNo: member.rollNo,
          email: member.email,
          memberType: member.memberType,
        })),
        invites: membership.group.invites.map((invite) => ({
          id: invite.id,
          invitedEmail: invite.invitedEmail,
          invitedRollNo: invite.invitedRollNo,
          expiresAt: invite.expiresAt.toISOString(),
        })),
      }
    : null;

  const receivedInvites: ReceivedInvite[] = received.map((invite) => ({
    id: invite.id,
    groupLabel: invite.group.groupNo ?? invite.group.projectTitle ?? "a group",
    code: invite.group.code,
    expiresAt: invite.expiresAt.toISOString(),
  }));

  return <GroupOnboarding group={group} receivedInvites={receivedInvites} />;
}
