"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  serviceCategoryFormSchema,
  serviceItemFormSchema,
  updateServiceCategorySchema,
  updateServiceItemSchema,
} from "@/lib/validations/service-catalog";

export type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function requireAdminId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session.user.id;
}

export async function getServiceCategoriesForAdmin() {
  if (!(await requireAdminId())) return [];
  return prisma.serviceCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] },
    },
  });
}

export async function getServiceCategoryById(id: string) {
  if (!(await requireAdminId())) return null;
  return prisma.serviceCategory.findUnique({
    where: { id },
    include: { items: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
}

export async function getServiceItemForEdit(categoryId: string, itemId: string) {
  if (!(await requireAdminId())) return null;
  return prisma.serviceItem.findFirst({
    where: { id: itemId, serviceCategoryId: categoryId },
  });
}

export async function createServiceCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  const parsed = serviceCategoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }
  const { name, sortOrder, allowsCustomPricing, isActive } = parsed.data;
  try {
    const row = await prisma.serviceCategory.create({
      data: { name, sortOrder, allowsCustomPricing, isActive },
      select: { id: true },
    });
    revalidatePath("/admin/services");
    revalidatePath("/reception/orders/new");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not create category (name may already exist)." };
  }
}

export async function updateServiceCategory(input: unknown): Promise<ActionResult> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  const parsed = updateServiceCategorySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }
  const { id, name, sortOrder, allowsCustomPricing, isActive } = parsed.data;
  const existing = await prisma.serviceCategory.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Category not found." };
  try {
    await prisma.$transaction(async (tx) => {
      await tx.serviceCategory.update({
        where: { id },
        data: { name, sortOrder, allowsCustomPricing, isActive },
      });
      if (allowsCustomPricing) {
        await tx.serviceItem.updateMany({
          where: { serviceCategoryId: id },
          data: { isActive: false },
        });
      }
    });
    revalidatePath("/admin/services");
    revalidatePath(`/admin/services/${id}/edit`);
    revalidatePath("/reception/orders/new");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not update category (name may already exist)." };
  }
}

export async function deactivateServiceCategory(id: string): Promise<ActionResult> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  try {
    await prisma.serviceCategory.update({
      where: { id },
      data: { isActive: false },
    });
    revalidatePath("/admin/services");
    revalidatePath("/reception/orders/new");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not deactivate category." };
  }
}

export async function createServiceItem(
  categoryId: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  const cat = await prisma.serviceCategory.findFirst({
    where: { id: categoryId, isActive: true },
  });
  if (!cat) return { ok: false, error: "Category not found or inactive." };
  if (cat.allowsCustomPricing) {
    return { ok: false, error: "Custom-pricing categories do not use catalog items." };
  }
  const parsed = serviceItemFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }
  const { name, defaultPrice, sortOrder, isActive } = parsed.data;
  try {
    const row = await prisma.serviceItem.create({
      data: {
        serviceCategoryId: categoryId,
        name,
        defaultPrice: new Prisma.Decimal(String(defaultPrice)),
        sortOrder,
        isActive,
      },
      select: { id: true },
    });
    revalidatePath("/admin/services");
    revalidatePath(`/admin/services/${categoryId}/edit`);
    revalidatePath("/reception/orders/new");
    return { ok: true, data: { id: row.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not create item (name may already exist in this category)." };
  }
}

export async function updateServiceItem(input: unknown): Promise<ActionResult> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  const parsed = updateServiceItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }
  const { id, serviceCategoryId, name, defaultPrice, sortOrder, isActive } = parsed.data;
  const cat = await prisma.serviceCategory.findFirst({
    where: { id: serviceCategoryId, isActive: true },
  });
  if (!cat) return { ok: false, error: "Category not found or inactive." };
  if (cat.allowsCustomPricing) {
    return { ok: false, error: "Custom-pricing categories do not use catalog items." };
  }
  const item = await prisma.serviceItem.findFirst({
    where: { id, serviceCategoryId },
  });
  if (!item) return { ok: false, error: "Item not found." };
  try {
    await prisma.serviceItem.update({
      where: { id },
      data: {
        name,
        defaultPrice: new Prisma.Decimal(String(defaultPrice)),
        sortOrder,
        isActive,
      },
    });
    revalidatePath("/admin/services");
    revalidatePath(`/admin/services/${serviceCategoryId}/edit`);
    revalidatePath(`/admin/services/${serviceCategoryId}/items/${id}/edit`);
    revalidatePath("/reception/orders/new");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not update item (name may already exist in this category)." };
  }
}

export async function deactivateServiceItem(itemId: string, categoryId: string): Promise<ActionResult> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  const item = await prisma.serviceItem.findFirst({
    where: { id: itemId, serviceCategoryId: categoryId },
  });
  if (!item) return { ok: false, error: "Item not found." };
  try {
    await prisma.serviceItem.update({
      where: { id: itemId },
      data: { isActive: false },
    });
    revalidatePath("/admin/services");
    revalidatePath(`/admin/services/${categoryId}/edit`);
    revalidatePath("/reception/orders/new");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not deactivate item." };
  }
}
