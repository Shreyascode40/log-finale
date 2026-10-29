import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/permissions";
import { homeForRole } from "@/lib/roles";

/**
 * Landing page: signed-in users go straight to their dashboard, everyone
 * else to the login page. There is no public homepage.
 */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homeForRole(user.role) : "/login");
}
