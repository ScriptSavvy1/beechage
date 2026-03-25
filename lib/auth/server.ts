import { auth } from "@/lib/auth";
import type { Role } from "@prisma/client";
import { redirect } from "next/navigation";

export async function requireSession() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(allowed: Role | Role[]) {
  const session = await requireSession();
  const roles = Array.isArray(allowed) ? allowed : [allowed];
  if (!roles.includes(session.user.role)) {
    redirect(session.user.role === "ADMIN" ? "/admin" : "/reception");
  }
  return session;
}
