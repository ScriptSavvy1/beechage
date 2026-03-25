import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Shared NextAuth options (session, pages, callbacks).
 * Credentials provider lives in `lib/auth.ts` so middleware never bundles Prisma/bcrypt.
 */
const authConfig = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = (user as { role: Role }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
} satisfies Pick<NextAuthConfig, "session" | "pages" | "callbacks">;

export default authConfig;
