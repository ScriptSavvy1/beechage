import { describe, it, expect } from "vitest";
import { expenseFormSchema, updateExpenseSchema } from "./expense";

describe("expenseFormSchema", () => {
  it("accepts a valid expense", () => {
    const result = expenseFormSchema.safeParse({
      expenseCategoryId: "cat-1",
      amount: 150.5,
      expenseDate: "2026-03-25",
      description: "Office supplies",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing category", () => {
    const result = expenseFormSchema.safeParse({
      expenseCategoryId: "",
      amount: 100,
      expenseDate: "2026-03-25",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = expenseFormSchema.safeParse({
      expenseCategoryId: "cat-1",
      amount: 0,
      expenseDate: "2026-03-25",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = expenseFormSchema.safeParse({
      expenseCategoryId: "cat-1",
      amount: -50,
      expenseDate: "2026-03-25",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing date", () => {
    const result = expenseFormSchema.safeParse({
      expenseCategoryId: "cat-1",
      amount: 100,
      expenseDate: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date string", () => {
    const result = expenseFormSchema.safeParse({
      expenseCategoryId: "cat-1",
      amount: 100,
      expenseDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("accepts null description", () => {
    const result = expenseFormSchema.safeParse({
      expenseCategoryId: "cat-1",
      amount: 100,
      expenseDate: "2026-03-25",
      description: null,
    });
    expect(result.success).toBe(true);
  });

  it("accepts omitted description", () => {
    const result = expenseFormSchema.safeParse({
      expenseCategoryId: "cat-1",
      amount: 100,
      expenseDate: "2026-03-25",
    });
    expect(result.success).toBe(true);
  });
});

describe("updateExpenseSchema", () => {
  it("accepts valid update with id", () => {
    const result = updateExpenseSchema.safeParse({
      id: "expense-1",
      expenseCategoryId: "cat-1",
      amount: 200,
      expenseDate: "2026-03-25",
    });
    expect(result.success).toBe(true);
  });

  it("rejects update without id", () => {
    const result = updateExpenseSchema.safeParse({
      id: "",
      expenseCategoryId: "cat-1",
      amount: 200,
      expenseDate: "2026-03-25",
    });
    expect(result.success).toBe(false);
  });
});
