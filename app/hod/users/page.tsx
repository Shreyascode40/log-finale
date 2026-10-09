import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/permissions";
import { UsersManager, type GuideRow } from "@/components/admin/users-manager";

export const metadata = { title: "Guide accounts — Digital BE Log Book" };

export default async function HodUsersPage() {
  await requireRole("HOD");

  const guides = await prisma.user.findMany({
    where: { role: "GUIDE" },
    orderBy: { name: "asc" },
    include: { _count: { select: { guidesGroups: true } } },
  });

  const rows: GuideRow[] = guides.map((guide) => ({
    id: guide.id,
    name: guide.name,
    email: guide.email,
    mobile: guide.mobile,
    active: guide.active,
    groups: guide._count.guidesGroups,
  }));

  return <UsersManager guides={rows} />;
}
