"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteExpense } from "@/lib/actions/expenses";

type Props = {
  expenseId: string;
  label?: string;
};

export function DeleteExpenseButton({ expenseId, label = "Delete" }: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "confirm">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setPhase("idle");
    setError(null);
  };

  const onDelete = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteExpense(expenseId);
      if (result.ok) {
        router.refresh();
        reset();
        return;
      }
      setError(result.error);
    });
  };

  if (phase === "confirm") {
    return (
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        <span className="text-xs font-medium text-zinc-600">Delete this expense?</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={reset}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={onDelete}
            className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isPending ? "…" : "Confirm"}
          </button>
        </div>
        {error ? <p className="w-full text-right text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPhase("confirm")}
      className="rounded-md px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50"
    >
      {label}
    </button>
  );
}
