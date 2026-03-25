"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { AlertBanner } from "@/components/forms/alert-banner";
import { FormField } from "@/components/forms/form-field";
import { createExpense, updateExpense } from "@/lib/actions/expenses";
import { todayLocalDateInputValue } from "@/lib/dates";
import { formInputClassName } from "@/lib/ui/form-classes";
import { expenseFormSchema, type ExpenseFormInput } from "@/lib/validations/expense";

type Category = { id: string; name: string };

type Props = {
  categories: Category[];
  mode: "create" | "edit";
  expenseId?: string;
  defaultValues?: Partial<ExpenseFormInput>;
};

export function ExpenseForm({ categories, mode, expenseId, defaultValues }: Props) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const mergedDefaults: ExpenseFormInput = {
    expenseCategoryId: defaultValues?.expenseCategoryId ?? categories[0]?.id ?? "",
    amount: defaultValues?.amount ?? 0.01,
    expenseDate:
      defaultValues?.expenseDate ??
      (mode === "create" ? todayLocalDateInputValue() : ""),
    description: defaultValues?.description ?? "",
  };

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ExpenseFormInput>({
    resolver: zodResolver(expenseFormSchema),
    defaultValues: mergedDefaults,
  });

  const onSubmit = (data: ExpenseFormInput) => {
    setServerError(null);
    startTransition(async () => {
      if (mode === "create") {
        const result = await createExpense(data);
        if (result.ok) {
          router.push("/admin/expenses");
          router.refresh();
          return;
        }
        setServerError(result.error);
        return;
      }
      if (!expenseId) {
        setServerError("Missing expense id.");
        return;
      }
      const result = await updateExpense({ ...data, id: expenseId });
      if (result.ok) {
        router.push("/admin/expenses");
        router.refresh();
        return;
      }
      setServerError(result.error);
    });
  };

  if (categories.length === 0) {
    return (
      <AlertBanner tone="error">
        No expense categories are configured. Run the database seed after migrating.
      </AlertBanner>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-xl space-y-6">
      {serverError ? (
        <AlertBanner tone="error">{serverError}</AlertBanner>
      ) : null}

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">
          {mode === "create" ? "New expense" : "Edit expense"}
        </h2>

        <div className="mt-6 space-y-5">
          <FormField
            label="Category"
            htmlFor="expenseCategoryId"
            error={errors.expenseCategoryId?.message}
            required
          >
            <select
              id="expenseCategoryId"
              className={formInputClassName}
              disabled={isPending}
              {...register("expenseCategoryId")}
            >
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Amount" htmlFor="amount" error={errors.amount?.message} required>
            <input
              id="amount"
              type="number"
              min={0}
              step={0.01}
              className={formInputClassName}
              disabled={isPending}
              {...register("amount", { valueAsNumber: true })}
            />
          </FormField>

          <FormField
            label="Date"
            htmlFor="expenseDate"
            error={errors.expenseDate?.message}
            required
          >
            <input
              id="expenseDate"
              type="date"
              className={formInputClassName}
              disabled={isPending}
              {...register("expenseDate")}
            />
          </FormField>

          <FormField label="Description" htmlFor="description" error={errors.description?.message}>
            <textarea
              id="description"
              rows={4}
              placeholder="Vendor, invoice number, notes…"
              className={formInputClassName}
              disabled={isPending}
              {...register("description")}
            />
          </FormField>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-zinc-800 disabled:opacity-60"
          >
            {isPending ? "Saving…" : mode === "create" ? "Create expense" : "Save changes"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => router.push("/admin/expenses")}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </form>
  );
}
