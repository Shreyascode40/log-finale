import { requireRole } from "@/lib/permissions";
import { getStudentGroupOnboarding } from "@/lib/services/group";
import {
  GroupOnboarding,
  type GroupView,
  type ReceivedInvite,
} from "@/components/student/group-onboarding";

export const metadata = { title: "My group — Digital BE Log Book" };

export default async function StudentGroupPage() {
  const user = await requireRole("STUDENT");
  const { membership, received } = await getStudentGroupOnboarding();

  const group: GroupView | null = membership
    ? {
        id: membership.group.id,
        code: membership.group.code ?? "",
        groupNo: membership.group.groupNo,
        projectTitle: membership.group.projectTitle,
        area: membership.group.area,
        academicYear: membership.group.academicYear,
        department: membership.group.department,
        status: membership.group.status,
        rejectReason: membership.group.rejectReason,
        guideName: membership.group.guide?.name ?? null,
        creatorId: membership.group.creatorId ?? "",
        myUserId: user.id,
        members: membership.group.members.map((member) => ({
          id: member.id,
          userId: member.userId,
          name: member.name ?? "",
          rollNo: member.rollNo,
          email: member.email,
          memberType: member.memberType,
        })),
        invites: membership.group.invites.map((invite) => ({
          id: invite.id,
          invitedEmail: invite.invitedEmail,
          invitedRollNo: invite.invitedRollNo,
          expiresAt: new Date(invite.expiresAt).toISOString(),
        })),
      }
    : null;

  const receivedInvites: ReceivedInvite[] = received.map((invite) => ({
    id: invite.id,
    groupLabel: invite.group.groupNo ?? invite.group.projectTitle ?? "a group",
    code: invite.group.code ?? "",
    expiresAt: new Date(invite.expiresAt).toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <GroupOnboarding group={group} receivedInvites={receivedInvites} />
    </div>
  );
}
