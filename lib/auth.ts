import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

/**
 * Returns session-like object matching the shape the rest of the app expects.
 * Drop-in replacement for the old NextAuth auth() call.
 */
export async function auth() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || null,
      role: user.user_metadata?.role || "RECEPTION",
    },
  };
}

export async function requireRole(allowedRoles: string[]) {
  const session = await auth();
  if (!session?.user || !allowedRoles.includes(session.user.role)) {
    redirect("/login");
  }
  return session.user;
}
