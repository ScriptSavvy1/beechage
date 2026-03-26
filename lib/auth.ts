import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import authConfig from "@/auth.config";
import { prisma } from "@/lib/prisma";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        try {
          console.log("[AUTH] authorize() called");
          const parsed = loginSchema.safeParse(credentials);
          if (!parsed.success) {
            console.log("[AUTH] schema parse failed:", parsed.error.flatten());
            return null;
          }

          const { email, password } = parsed.data;
          console.log("[AUTH] looking up user:", email);
          const user = await prisma.user.findUnique({ where: { email } });
          console.log("[AUTH] user found:", !!user, "isActive:", user?.isActive);
          if (!user?.isActive) return null;

          const valid = await bcrypt.compare(password, user.passwordHash);
          console.log("[AUTH] bcrypt valid:", valid);
          if (!valid) return null;

          console.log("[AUTH] authorize() returning user:", user.id, user.role);
          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
          };
        } catch (error) {
          console.error("[AUTH] Caught error in authorize():", error);
          throw error;
        }
      },
    }),
  ],
  secret: process.env.AUTH_SECRET,
  trustHost: true,
});
