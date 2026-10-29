import { requireRole } from "@/lib/permissions";
import { listAdminGroups } from "@/lib/services/admin";
import { GroupsManager } from "@/components/admin/groups-manager";

export const metadata = { title: "Groups — Digital BE Log Book" };

export default async function HodGroupsPage() {
  await requireRole("HOD");
  const { groups, guides } = await listAdminGroups();
  return <GroupsManager groups={groups} guides={guides} />;
}
