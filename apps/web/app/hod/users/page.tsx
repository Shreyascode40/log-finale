import { requireRole } from "@/lib/permissions";
import { listGuides } from "@/lib/services/admin";
import { UsersManager } from "@/components/admin/users-manager";

export const metadata = { title: "Guide accounts — Digital BE Log Book" };

export default async function HodUsersPage() {
  await requireRole("HOD");
  const rows = await listGuides();
  return <UsersManager guides={rows} />;
}
