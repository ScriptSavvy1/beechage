/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { expenseFormSchema, updateExpenseSchema } from "@/lib/validations/expense";

export type ExpenseActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireAdminUserId(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "ADMIN") return null;
  return session.user.id;
}

export async function getExpenseCategoriesForAdmin() {
  if (!(await requireAdminUserId())) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("ExpenseCategory")
    .select("id, name")
    .eq("isActive", true)
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true });

  return data ?? [];
}

export type ExpenseFilters = {
  q?: string;
  categoryId?: string;
  userId?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
};

export async function getExpensesList(filters: ExpenseFilters = {}) {
  if (!(await requireAdminUserId())) return [];

  const supabase = await createClient();
  let query = supabase
    .from("Expense")
    .select("*, createdBy:users(name, email)");

  if (filters.categoryId) {
    query = query.eq("expenseCategoryId", filters.categoryId);
  }
  if (filters.userId) {
    query = query.eq("createdById", filters.userId);
  }
  if (filters.from) {
    query = query.gte("expenseDate", `${filters.from}T00:00:00.000Z`);
  }
  if (filters.to) {
    query = query.lte("expenseDate", `${filters.to}T23:59:59.999Z`);
  }
  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      query = query.or(`description.ilike.%${q}%,categoryName.ilike.%${q}%`);
    }
  }

  const { data: expenses } = await query
    .order("expenseDate", { ascending: false })
    .order("createdAt", { ascending: false });

  if (!expenses) return [];

  // Return Prisma-compatible shape with Decimal-like objects
  return expenses.map((e: any) => ({
    ...e,
    amount: { toNumber: () => Number(e.amount), toString: () => String(e.amount) },
    expenseDate: new Date(e.expenseDate),
    createdAt: new Date(e.createdAt),
    updatedAt: new Date(e.updatedAt),
    createdBy: Array.isArray(e.createdBy) ? e.createdBy[0] : e.createdBy,
  }));
}

export async function getExpenseById(id: string) {
  if (!(await requireAdminUserId())) return null;

  const supabase = await createClient();
  const { data: expense } = await supabase
    .from("Expense")
    .select("*, createdBy:users(id, name, email)")
    .eq("id", id)
    .single();

  if (!expense) return null;

  return {
    ...expense,
    amount: { toNumber: () => Number(expense.amount), toString: () => String(expense.amount) },
    expenseDate: new Date(expense.expenseDate),
    createdAt: new Date(expense.createdAt),
    updatedAt: new Date(expense.updatedAt),
    createdBy: Array.isArray(expense.createdBy) ? expense.createdBy[0] : expense.createdBy,
  };
}

export async function createExpense(input: unknown): Promise<ExpenseActionResult<{ id: string }>> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: "Unauthorized." };

  const parsed = expenseFormSchema.safeParse(input);
  if (!parsed.success) {
    const msg =
      parsed.error.flatten().fieldErrors.amount?.[0] ??
      parsed.error.flatten().fieldErrors.expenseCategoryId?.[0] ??
      parsed.error.flatten().fieldErrors.expenseDate?.[0] ??
      parsed.error.errors[0]?.message ??
      "Invalid data.";
    return { ok: false, error: msg };
  }

  const { expenseCategoryId, amount, expenseDate, description } = parsed.data;

  const supabase = await createClient();
  const { data: category } = await supabase
    .from("ExpenseCategory")
    .select("id, name")
    .eq("id", expenseCategoryId)
    .eq("isActive", true)
    .single();

  if (!category) return { ok: false, error: "Category not found or inactive." };

  try {
    const { data: expense, error } = await supabase
      .from("Expense")
      .insert({
        expenseCategoryId: category.id,
        categoryName: category.name,
        amount,
        expenseDate,
        description: description?.trim() || null,
        createdById: adminId,
      })
      .select("id")
      .single();

    if (error) throw error;

    revalidatePath("/admin/expenses");
    return { ok: true, data: { id: expense.id } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not save expense. Try again." };
  }
}

export async function updateExpense(input: unknown): Promise<ExpenseActionResult> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: "Unauthorized." };

  const parsed = updateExpenseSchema.safeParse(input);
  if (!parsed.success) {
    const msg =
      parsed.error.flatten().fieldErrors.amount?.[0] ??
      parsed.error.flatten().fieldErrors.expenseCategoryId?.[0] ??
      parsed.error.errors[0]?.message ??
      "Invalid data.";
    return { ok: false, error: msg };
  }

  const { id, expenseCategoryId, amount, expenseDate, description } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("Expense")
    .select("id")
    .eq("id", id)
    .single();

  if (!existing) return { ok: false, error: "Expense not found." };

  const { data: category } = await supabase
    .from("ExpenseCategory")
    .select("id, name")
    .eq("id", expenseCategoryId)
    .eq("isActive", true)
    .single();

  if (!category) return { ok: false, error: "Category not found or inactive." };

  try {
    const { error } = await supabase
      .from("Expense")
      .update({
        expenseCategoryId: category.id,
        categoryName: category.name,
        amount,
        expenseDate,
        description: description?.trim() || null,
      })
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/admin/expenses");
    revalidatePath(`/admin/expenses/${id}/edit`);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not update expense. Try again." };
  }
}

export async function deleteExpense(id: string): Promise<ExpenseActionResult> {
  const adminId = await requireAdminUserId();
  if (!adminId) return { ok: false, error: "Unauthorized." };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("Expense")
    .select("id")
    .eq("id", id)
    .single();

  if (!existing) return { ok: false, error: "Expense not found." };

  try {
    const { error } = await supabase
      .from("Expense")
      .delete()
      .eq("id", id);

    if (error) throw error;

    revalidatePath("/admin/expenses");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not delete expense. Try again." };
  }
}
