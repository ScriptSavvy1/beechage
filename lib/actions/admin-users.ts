"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@supabase/ssr";
import { createReceptionUserSchema } from "@/lib/validations/admin-users";
import { requireTenantAdmin } from "@/lib/tenant";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

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
    // via handle_new_user() reading from app_metadata

    revalidatePath("/admin/users/new");
    revalidatePath("/admin");
    return { ok: true, data: { id: user.user.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not create user." };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  const ctx = await requireTenantAdmin();

  // Cannot delete yourself
  if (ctx.userId === userId) {
    return { ok: false, error: "Cannot delete your own account." };
  }

  const supabaseAdmin = getServiceRoleClient();

  // Verify user belongs to this tenant (manual check — service_role bypasses RLS)
  const { data: targetUser } = await supabaseAdmin
    .from("users")
    .select("id, tenant_id")
    .eq("id", userId)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!targetUser) return { ok: false, error: "User not found in your organization." };

  // Check for linked orders (scoped to tenant)
  const { count: orderCount } = await supabaseAdmin
    .from("Order")
    .select("id", { count: "exact", head: true })
    .eq("createdById", userId)
    .eq("tenant_id", ctx.tenantId);

  if (orderCount && orderCount > 0) {
    return { ok: false, error: `Cannot delete: user has ${orderCount} order(s). Deactivate instead.` };
  }

  // Check for linked expenses (scoped to tenant)
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

  // Verify user belongs to this tenant
  const { data: targetUser } = await supabaseAdmin
    .from("users")
    .select("id, tenant_id")
    .eq("id", userId)
    .eq("tenant_id", ctx.tenantId)
    .single();

  if (!targetUser) return { ok: false, error: "User not found in your organization." };

  try {
    // Deactivate in public.users
    const { error: userError } = await supabaseAdmin
      .from("users")
      .update({ isActive: false })
      .eq("id", userId);

    if (userError) throw userError;

    // Deactivate membership
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
