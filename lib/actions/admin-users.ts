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

  const { email, name, password } = parsed.data;

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
        role: Role.RECEPTION,
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
