import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { authenticate } from "@/lib/services/auth";
import { RATE_LIMITS, rateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/auth";

/**
 * NextAuth (credentials, JWT sessions). The session carries `user.id` and
 * `user.role`, which every server-side permission check reads from.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Email and password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        // Throttle login attempts per email address (in addition to IP-level
        // limits applied by the host/proxy in production).
        const limit = rateLimit(
          `login:${parsed.data.email}`,
          RATE_LIMITS.login.limit,
          RATE_LIMITS.login.windowMs,
        );
        if (!limit.ok) return null;

        // Unverified or inactive accounts intentionally return null: NextAuth
        // then refuses the login and the client shows a single generic message.
        const result = await authenticate(parsed.data.email, parsed.data.password);
        if (!result.ok) return null;

        return {
          id: result.user.id,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role ?? "STUDENT";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
};
