import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import {
  AssignmentsManager,
  type AssignmentRow,
  type GuideOption,
} from "@/components/admin/assignments-manager";

export const metadata = { title: "Guide assignments — Digital BE Log Book" };

export default async function HodAssignmentsPage() {
  await requireRole("HOD");

  const [groups, guides] = await Promise.all([
    prisma.group.findMany({
      where: { status: { in: ["SUBMITTED", "ACTIVE"] } },
      orderBy: { createdAt: "desc" },
      include: { guide: { select: { id: true, name: true } } },
    }),
    prisma.user.findMany({
      where: { role: "GUIDE", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: AssignmentRow[] = groups.map((group) => ({
    id: group.id,
    groupNo: group.groupNo,
    projectTitle: group.projectTitle,
    status: group.status,
    guideId: group.guideId,
    guideName: group.guide?.name ?? null,
  }));

  const guideOptions: GuideOption[] = guides;

  return <AssignmentsManager groups={rows} guides={guideOptions} />;
}
