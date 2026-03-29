/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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
  const supabase = await createClient();
  const { data } = await supabase
    .from("ServiceCategory")
    .select("*, items:ServiceItem(*)")
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true });

  if (!data) return [];

  // Sort nested items & convert defaultPrice to Decimal-compatible
  return data.map((c: any) => ({
    ...c,
    items: (c.items || [])
      .sort((a: any, b: any) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      })
      .map((i: any) => ({
        ...i,
        pricingType: i.pricingType || "FIXED",
        defaultPrice: { toNumber: () => Number(i.defaultPrice), toString: () => String(i.defaultPrice) },
      })),
  }));
}

export async function getServiceCategoryById(id: string) {
  if (!(await requireAdminId())) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ServiceCategory")
    .select("*, items:ServiceItem(*)")
    .eq("id", id)
    .single();

  if (!data) return null;

  return {
    ...data,
    items: (data.items || [])
      .sort((a: any, b: any) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      })
      .map((i: any) => ({
        ...i,
        pricingType: i.pricingType || "FIXED",
        defaultPrice: { toNumber: () => Number(i.defaultPrice), toString: () => String(i.defaultPrice) },
      })),
  };
}

export async function getServiceItemForEdit(categoryId: string, itemId: string) {
  if (!(await requireAdminId())) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("ServiceItem")
    .select("*")
    .eq("id", itemId)
    .eq("serviceCategoryId", categoryId)
    .single();

  if (!data) return null;

  return {
    ...data,
    pricingType: data.pricingType || "FIXED",
    defaultPrice: { toNumber: () => Number(data.defaultPrice), toString: () => String(data.defaultPrice) },
  };
}

export async function createServiceCategory(input: unknown): Promise<ActionResult<{ id: string }>> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  const parsed = serviceCategoryFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }
  const { name, sortOrder, allowsCustomPricing, isActive } = parsed.data;
  try {
    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("ServiceCategory")
      .insert({ name, sortOrder, allowsCustomPricing, isActive })
      .select("id")
      .single();

    if (error) throw error;

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

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ServiceCategory")
    .select("id")
    .eq("id", id)
    .single();

  if (!existing) return { ok: false, error: "Category not found." };

  try {
    // Update the category
    const { error: updateError } = await supabase
      .from("ServiceCategory")
      .update({ name, sortOrder, allowsCustomPricing, isActive })
      .eq("id", id);

    if (updateError) throw updateError;

    // If custom pricing enabled, deactivate all catalog items (same as Prisma transaction)
    if (allowsCustomPricing) {
      const { error: deactivateError } = await supabase
        .from("ServiceItem")
        .update({ isActive: false })
        .eq("serviceCategoryId", id);

      if (deactivateError) throw deactivateError;
    }

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
    const supabase = await createClient();
    const { error } = await supabase
      .from("ServiceCategory")
      .update({ isActive: false })
      .eq("id", id);

    if (error) throw error;

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

  const supabase = await createClient();
  const { data: cat } = await supabase
    .from("ServiceCategory")
    .select("id, allowsCustomPricing")
    .eq("id", categoryId)
    .eq("isActive", true)
    .single();

  if (!cat) return { ok: false, error: "Category not found or inactive." };
  if (cat.allowsCustomPricing) {
    return { ok: false, error: "Custom-pricing categories do not use catalog items." };
  }

  const parsed = serviceItemFormSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }
  const { name, defaultPrice, pricingType, sortOrder, isActive } = parsed.data;
  try {
    const { data: row, error } = await supabase
      .from("ServiceItem")
      .insert({
        serviceCategoryId: categoryId,
        name,
        defaultPrice,
        pricingType,
        sortOrder,
        isActive,
      })
      .select("id")
      .single();

    if (error) throw error;

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
  const { id, serviceCategoryId, name, defaultPrice, pricingType, sortOrder, isActive } = parsed.data;

  const supabase = await createClient();
  const { data: cat } = await supabase
    .from("ServiceCategory")
    .select("id, allowsCustomPricing")
    .eq("id", serviceCategoryId)
    .eq("isActive", true)
    .single();

  if (!cat) return { ok: false, error: "Category not found or inactive." };
  if (cat.allowsCustomPricing) {
    return { ok: false, error: "Custom-pricing categories do not use catalog items." };
  }

  const { data: item } = await supabase
    .from("ServiceItem")
    .select("id")
    .eq("id", id)
    .eq("serviceCategoryId", serviceCategoryId)
    .single();

  if (!item) return { ok: false, error: "Item not found." };

  try {
    const { error } = await supabase
      .from("ServiceItem")
      .update({ name, defaultPrice, pricingType, sortOrder, isActive })
      .eq("id", id);

    if (error) throw error;

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

  const supabase = await createClient();
  const { data: item } = await supabase
    .from("ServiceItem")
    .select("id")
    .eq("id", itemId)
    .eq("serviceCategoryId", categoryId)
    .single();

  if (!item) return { ok: false, error: "Item not found." };

  try {
    const { error } = await supabase
      .from("ServiceItem")
      .update({ isActive: false })
      .eq("id", itemId);

    if (error) throw error;

    revalidatePath("/admin/services");
    revalidatePath(`/admin/services/${categoryId}/edit`);
    revalidatePath("/reception/orders/new");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not deactivate item." };
  }
}

export async function deleteServiceCategory(id: string): Promise<ActionResult> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  const supabase = await createClient();

  // Check if any order items reference this category
  const { count } = await supabase
    .from("OrderItem")
    .select("id", { count: "exact", head: true })
    .eq("serviceCategoryId", id);

  if (count && count > 0) {
    return { ok: false, error: `Cannot delete: ${count} order item(s) reference this category. Deactivate instead.` };
  }

  try {
    // Delete items first (cascade should handle, but be explicit)
    await supabase.from("ServiceItem").delete().eq("serviceCategoryId", id);
    const { error } = await supabase.from("ServiceCategory").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin/services");
    revalidatePath("/reception/orders/new");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not delete category." };
  }
}

export async function deleteServiceItem(itemId: string, categoryId: string): Promise<ActionResult> {
  if (!(await requireAdminId())) return { ok: false, error: "Unauthorized." };
  const supabase = await createClient();

  // Check if any order items reference this item
  const { count } = await supabase
    .from("OrderItem")
    .select("id", { count: "exact", head: true })
    .eq("serviceItemId", itemId);

  if (count && count > 0) {
    return { ok: false, error: `Cannot delete: ${count} order(s) reference this item. Deactivate instead.` };
  }

  try {
    const { error } = await supabase.from("ServiceItem").delete().eq("id", itemId);
    if (error) throw error;

    revalidatePath("/admin/services");
    revalidatePath(`/admin/services/${categoryId}/edit`);
    revalidatePath("/reception/orders/new");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not delete item." };
  }
}
