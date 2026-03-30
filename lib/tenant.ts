import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ADMIN_ROLES } from "@/lib/types/enums";

export type TenantContext = {
  userId: string;
  email: string;
  name: string | null;
  tenantId: string;
  tenantSlug: string;
  role: string;
  branchId: string | null;
};

/**
 * Resolves the current user's tenant context from their JWT app_metadata.
 * This is the SINGLE SOURCE OF TRUTH for tenant resolution.
 * All server actions should call this (or requireTenantRole) before any DB operation.
 */
export async function getTenantContext(): Promise<TenantContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const tenantId = user.app_metadata?.tenant_id;
  const role = user.app_metadata?.role || "RECEPTION";

  if (!tenantId) return null;

  // Get tenant slug (cached in JWT for most calls, but we verify)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("slug")
    .eq("id", tenantId)
    .single();

  // Get branch from membership if available
  const { data: membership } = await supabase
    .from("tenant_memberships")
    .select("branch_id")
    .eq("user_id", user.id)
    .eq("tenant_id", tenantId)
    .single();

  return {
    userId: user.id,
    email: user.email || "",
    name: user.user_metadata?.name || null,
    tenantId,
    tenantSlug: tenant?.slug || "unknown",
    role,
    branchId: membership?.branch_id || null,
  };
}

/**
 * Requires the user to have one of the specified roles within their tenant.
 * Redirects to /login if not authenticated, or returns the context.
 */
export async function requireTenantRole(allowedRoles: string[]): Promise<TenantContext> {
  const ctx = await getTenantContext();
  if (!ctx || !allowedRoles.includes(ctx.role)) {
    redirect("/login");
  }
  return ctx;
}

/**
 * Requires admin-level access (ADMIN only).
 */
export async function requireTenantAdmin(): Promise<TenantContext> {
  return requireTenantRole(ADMIN_ROLES as unknown as string[]);
}
