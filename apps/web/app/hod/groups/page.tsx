import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { GroupsManager, type GroupRow, type GuideOption } from "@/components/admin/groups-manager";

export const metadata = { title: "Groups — Digital BE Log Book" };

export default async function HodGroupsPage() {
  await requireRole("HOD");

  const [groups, guides] = await Promise.all([
    prisma.group.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        guide: { select: { name: true } },
        creator: { select: { name: true } },
        members: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, rollNo: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "GUIDE", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const rows: GroupRow[] = groups.map((group) => ({
    id: group.id,
    groupNo: group.groupNo,
    projectTitle: group.projectTitle,
    area: group.area,
    status: group.status,
    rejectReason: group.rejectReason,
    isSponsored: group.isSponsored,
    guideName: group.guide?.name ?? null,
    creatorName: group.creator.name,
    members: group.members,
  }));

  const guideOptions: GuideOption[] = guides;

  return <GroupsManager groups={rows} guides={guideOptions} />;
}
