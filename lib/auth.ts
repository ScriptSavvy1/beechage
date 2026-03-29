import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ADMIN_ROLES } from "@/lib/types/enums";

/**
 * Returns session-like object matching the shape the rest of the app expects.
 * Now reads role and tenant from app_metadata (secure, admin-only writable).
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

  // Prefer app_metadata (secure) over user_metadata (user-writable)
  const role = user.app_metadata?.role || user.user_metadata?.role || "RECEPTION";
  const tenantId = user.app_metadata?.tenant_id || null;

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.user_metadata?.name || null,
      role,
      tenantId,
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

/** Check if user has admin-level access (OWNER or ADMIN) */
export function isAdminRole(role: string): boolean {
  return (ADMIN_ROLES as readonly string[]).includes(role);
}
