import { z } from "zod";

export const expenseFormSchema = z.object({
  expenseCategoryId: z.string().min(1, "Select a category"),
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  expenseDate: z
    .string()
    .min(1, "Date is required")
    .refine((s) => !Number.isNaN(Date.parse(s)), "Invalid date"),
  description: z.string().max(2000).optional().nullable(),
});

export const updateExpenseSchema = expenseFormSchema.extend({
  id: z.string().min(1, "Expense id is required"),
});

export type ExpenseFormInput = z.infer<typeof expenseFormSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
