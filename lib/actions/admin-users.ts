"use server";

import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createReceptionUserSchema } from "@/lib/validations/admin-users";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function requireAdminId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session.user.id;
}

export async function createReceptionUser(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  const parsed = createReceptionUserSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }
  const { email, name, password } = parsed.data;
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { ok: false, error: "A user with this email already exists." };

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        name: name?.trim() || null,
        passwordHash,
        role: Role.RECEPTION,
      },
      select: { id: true },
    });
    revalidatePath("/admin/users/new");
    revalidatePath("/admin");
    return { ok: true, data: { id: user.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not create user." };
  }
}
