import { requireRole } from "@/lib/permissions";
import { listAssignments } from "@/lib/services/admin";
import { AssignmentsManager } from "@/components/admin/assignments-manager";

export const metadata = { title: "Guide assignments — Digital BE Log Book" };

export default async function HodAssignmentsPage() {
  await requireRole("HOD");
  const { groups, guides } = await listAssignments();
  return <AssignmentsManager groups={groups} guides={guides} />;
}
