"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createServerClient } from "@supabase/ssr";
import { createReceptionUserSchema } from "@/lib/validations/admin-users";
import { Role } from "@/lib/types/enums";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function requireAdminId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session.user.id;
}

// We need a Service Role client to create users without logging the current Admin out.
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
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };

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
    // This will trigger the DB trigger on auth.users to insert into public.users automatically
    const { data: user, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name: name?.trim() || null,
        role: role || Role.RECEPTION,
      }
    });

    if (error) {
      if (error.message.includes("already registered")) {
        return { ok: false, error: "A user with this email already exists." };
      }
      throw error;
    }

    revalidatePath("/admin/users/new");
    revalidatePath("/admin");
    return { ok: true, data: { id: user.user.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not create user." };
  }
}

export async function deleteUser(userId: string): Promise<ActionResult> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };

  // Cannot delete yourself
  const session = await auth();
  if (session?.user?.id === userId) {
    return { ok: false, error: "Cannot delete your own account." };
  }

  const supabaseAdmin = getServiceRoleClient();

  // Check for linked orders
  const { count: orderCount } = await supabaseAdmin
    .from("Order")
    .select("id", { count: "exact", head: true })
    .eq("createdById", userId);

  if (orderCount && orderCount > 0) {
    return { ok: false, error: `Cannot delete: user has ${orderCount} order(s). Deactivate instead.` };
  }

  // Check for linked expenses
  const { count: expenseCount } = await supabaseAdmin
    .from("Expense")
    .select("id", { count: "exact", head: true })
    .eq("createdById", userId);

  if (expenseCount && expenseCount > 0) {
    return { ok: false, error: `Cannot delete: user has ${expenseCount} expense(s). Deactivate instead.` };
  }

  try {
    // Delete from auth.users (cascade will remove public.users row)
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
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };

  const session = await auth();
  if (session?.user?.id === userId) {
    return { ok: false, error: "Cannot deactivate your own account." };
  }

  const supabaseAdmin = getServiceRoleClient();
  try {
    const { error } = await supabaseAdmin
      .from("users")
      .update({ isActive: false })
      .eq("id", userId);

    if (error) throw error;

    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not deactivate user." };
  }
}
