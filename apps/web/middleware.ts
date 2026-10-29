import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { canAccessPath, homeForRole } from "@/lib/roles";

/**
 * Protects /student, /guide and /hod. A logged-in user who opens a section that
 * belongs to another role is redirected to their own dashboard; anonymous users
 * are sent to /login. This mirrors lib/roles.canAccessPath, which is unit-tested.
 */
export default withAuth(
  function middleware(req) {
    const role = (req.nextauth.token?.role as string | undefined) ?? null;
    const { pathname } = req.nextUrl;
    if (role && !canAccessPath(role, pathname)) {
      return NextResponse.redirect(new URL(homeForRole(role), req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
    pages: { signIn: "/login" },
  },
);

export const config = {
  matcher: ["/student/:path*", "/guide/:path*", "/hod/:path*"],
};
