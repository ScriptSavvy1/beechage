"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
  return prisma.expenseCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true },
  });
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

  const where: Prisma.ExpenseWhereInput = {};

  if (filters.categoryId) {
    where.expenseCategoryId = filters.categoryId;
  }
  if (filters.userId) {
    where.createdById = filters.userId;
  }
  if (filters.from) {
    where.expenseDate = { ...where.expenseDate as object, gte: new Date(`${filters.from}T00:00:00.000`) };
  }
  if (filters.to) {
    where.expenseDate = { ...where.expenseDate as object, lte: new Date(`${filters.to}T23:59:59.999`) };
  }
  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      where.OR = [
        { description: { contains: q, mode: "insensitive" } },
        { categoryName: { contains: q, mode: "insensitive" } },
      ];
    }
  }

  return prisma.expense.findMany({
    where,
    orderBy: [{ expenseDate: "desc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { name: true, email: true } },
    },
  });
}

export async function getExpenseById(id: string) {
  if (!(await requireAdminUserId())) return null;
  return prisma.expense.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
    },
  });
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

  const category = await prisma.expenseCategory.findFirst({
    where: { id: expenseCategoryId, isActive: true },
    select: { id: true, name: true },
  });
  if (!category) return { ok: false, error: "Category not found or inactive." };

  try {
    const expense = await prisma.expense.create({
      data: {
        expenseCategoryId: category.id,
        categoryName: category.name,
        amount: new Prisma.Decimal(String(amount)),
        expenseDate: new Date(expenseDate),
        description: description?.trim() || null,
        createdById: adminId,
      },
      select: { id: true },
    });
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

  const existing = await prisma.expense.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Expense not found." };

  const category = await prisma.expenseCategory.findFirst({
    where: { id: expenseCategoryId, isActive: true },
    select: { id: true, name: true },
  });
  if (!category) return { ok: false, error: "Category not found or inactive." };

  try {
    await prisma.expense.update({
      where: { id },
      data: {
        expenseCategoryId: category.id,
        categoryName: category.name,
        amount: new Prisma.Decimal(String(amount)),
        expenseDate: new Date(expenseDate),
        description: description?.trim() || null,
      },
    });
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

  const existing = await prisma.expense.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Expense not found." };

  try {
    await prisma.expense.delete({ where: { id } });
    revalidatePath("/admin/expenses");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not delete expense. Try again." };
  }
}
