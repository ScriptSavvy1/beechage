"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createReceptionUserSchema } from "@/lib/validations/admin-users";
import { requireTenantAdmin } from "@/lib/tenant";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

// ─── Role Hierarchy ──────────────────────────────────────────
// OWNER (100) > ADMIN (50) > RECEPTION (10) = LAUNDRY (10)
const ROLE_RANK: Record<string, number> = {
  OWNER: 100,
  ADMIN: 50,
  RECEPTION: 10,
  LAUNDRY: 10,
};

/** Returns true if callerRole can assign targetRole */
function canAssignRole(callerRole: string, targetRole: string): boolean {
  const callerRank = ROLE_RANK[callerRole] ?? 0;
  const targetRank = ROLE_RANK[targetRole] ?? 0;
  // Caller can only assign roles strictly below their rank
  // OWNER (100) can assign ADMIN (50), RECEPTION (10), LAUNDRY (10)
  // ADMIN (50) can assign RECEPTION (10), LAUNDRY (10) — NOT ADMIN
  return callerRank > targetRank;
}

// Service Role client — bypasses RLS, used for admin operations
function getServiceRoleClient() {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => [],
        setAll: () => {},
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    }
  );
}

export async function createReceptionUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  const ctx = await requireTenantAdmin();

  const parsed = createReceptionUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }

  const { email, name, password, role } = parsed.data;

  // ── ROLE ESCALATION CHECK ──────────────────────────
  // OWNER can create: ADMIN, RECEPTION, LAUNDRY
  // ADMIN can create: RECEPTION, LAUNDRY
  // Zod schema already blocks OWNER role assignment
  if (!canAssignRole(ctx.role, role)) {
    return { ok: false, error: `Your role (${ctx.role}) cannot create ${role} users. Only an OWNER can do this.` };
  }
  // ───────────────────────────────────────────────────

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return { ok: false, error: "System missing SUPABASE_SERVICE_ROLE_KEY configuration." };
  }

  const supabaseAdmin = getServiceRoleClient();

  try {
    // Create auth user with tenant_id in app_metadata (secure, not user-writable)
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: {
        tenant_id: ctx.tenantId,
        role,
      },
      user_metadata: {
        name: name?.trim() || null,
      }
    });

    if (error) {
      if (error.message.includes("already registered")) {
        return { ok: false, error: "A user with this email already exists." };
      }
      throw error;
    }

    // The DB trigger auto-creates public.users + tenant_memberships rows
    // The trigger also caps the role (OWNER blocked at DB level)

    revalidatePath("/admin/users/new");
    revalidatePath("/admin");
    return { ok: true, data: { id: user.user.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not create user." };
  }
}

// ─── Update User Role ────────────────────────────────────────

export async function updateUserRole(
  targetUserId: string,
  newRole: string,
): Promise<ActionResult> {
  const ctx = await requireTenantAdmin();

  // Application-level checks (defense layer 1)
  if (targetUserId === ctx.userId) {
    return { ok: false, error: "Cannot change your own role." };
  }
  if (newRole === "OWNER") {
    return { ok: false, error: "OWNER role cannot be assigned via the application." };
  }
  if (!canAssignRole(ctx.role, newRole)) {
    return { ok: false, error: `Your role (${ctx.role}) cannot assign the ${newRole} role.` };
  }

  const supabaseAdmin = getServiceRoleClient();

  // Verify target belongs to this tenant
  const { data: targetMembership } = await supabaseAdmin
    .from("tenant_memberships")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!targetMembership) {
    return { ok: false, error: "User not found in your organization." };
  }

  // Cannot change OWNER's role
  if (targetMembership.role === "OWNER") {
    return { ok: false, error: "Cannot change an OWNER's role." };
  }

  // ADMIN cannot change another ADMIN
  if (ctx.role === "ADMIN" && targetMembership.role === "ADMIN") {
    return { ok: false, error: "ADMIN cannot change another ADMIN's role." };
  }

  try {
    // Use the secure DB function (defense layer 2)
    const { error } = await supabaseAdmin.rpc("safe_update_member_role", {
      p_caller_id: ctx.userId,
      p_target_user_id: targetUserId,
      p_tenant_id: ctx.tenantId,
      p_new_role: newRole,
    });

    if (error) {
      if (error.message.includes("ROLE_ESCALATION_BLOCKED")) {
        return { ok: false, error: "Role change blocked: insufficient permissions." };
      }
      throw error;
    }

    revalidatePath("/admin/users");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not update role." };
  }
}

// ─── Delete / Deactivate ─────────────────────────────────────

export async function deleteUser(userId: string): Promise<ActionResult> {
  const ctx = await requireTenantAdmin();

  if (ctx.userId === userId) {
    return { ok: false, error: "Cannot delete your own account." };
  }

  const supabaseAdmin = getServiceRoleClient();

  // Verify user belongs to this tenant
  const { data: targetUser } = await supabaseAdmin
    .from("tenant_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!targetUser) return { ok: false, error: "User not found in your organization." };

  // Cannot delete OWNER
  if (targetUser.role === "OWNER") {
    return { ok: false, error: "Cannot delete an OWNER account." };
  }

  // ADMIN cannot delete another ADMIN
  if (ctx.role === "ADMIN" && targetUser.role === "ADMIN") {
    return { ok: false, error: "ADMIN cannot delete another ADMIN. Only OWNER can do this." };
  }

  // Check for linked orders
  const { count: orderCount } = await supabaseAdmin
    .from("Order")
    .select("id", { count: "exact", head: true })
    .eq("createdById", userId)
    .eq("tenant_id", ctx.tenantId);

  if (orderCount && orderCount > 0) {
    return { ok: false, error: `Cannot delete: user has ${orderCount} order(s). Deactivate instead.` };
  }

  // Check for linked expenses
  const { count: expenseCount } = await supabaseAdmin
    .from("Expense")
    .select("id", { count: "exact", head: true })
    .eq("createdById", userId)
    .eq("tenant_id", ctx.tenantId);

  if (expenseCount && expenseCount > 0) {
    return { ok: false, error: `Cannot delete: user has ${expenseCount} expense(s). Deactivate instead.` };
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    revalidatePath("/admin/users/new");
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not delete user." };
  }
}

export async function deactivateUser(userId: string): Promise<ActionResult> {
  const ctx = await requireTenantAdmin();

  if (ctx.userId === userId) {
    return { ok: false, error: "Cannot deactivate your own account." };
  }

  const supabaseAdmin = getServiceRoleClient();

  // Verify user belongs to this tenant and check role
  const { data: targetMembership } = await supabaseAdmin
    .from("tenant_memberships")
    .select("role")
    .eq("user_id", userId)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!targetMembership) return { ok: false, error: "User not found in your organization." };

  // Cannot deactivate OWNER
  if (targetMembership.role === "OWNER") {
    return { ok: false, error: "Cannot deactivate an OWNER account." };
  }

  // ADMIN cannot deactivate another ADMIN
  if (ctx.role === "ADMIN" && targetMembership.role === "ADMIN") {
    return { ok: false, error: "ADMIN cannot deactivate another ADMIN." };
  }

  try {
    const { error: userError } = await supabaseAdmin
      .from("users")
      .update({ isActive: false })
      .eq("id", userId);

    if (userError) throw userError;

    const { error: memberError } = await supabaseAdmin
      .from("tenant_memberships")
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("tenant_id", ctx.tenantId);

    if (memberError) throw memberError;

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not deactivate user." };
  }
}
