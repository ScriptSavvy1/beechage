"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type DeleteAction = (...args: string[]) => Promise<{ ok: boolean; error?: string }>;

interface DeleteButtonProps {
  label: string;
  confirmText: string;
  action: DeleteAction;
  args: string[];
  redirectTo: string;
}

export function DeleteButton({ label, confirmText, action, args, redirectTo }: DeleteButtonProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "confirm">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (phase === "confirm") {
    return (
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        <span className="text-xs font-medium text-zinc-600">{confirmText}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={() => { setPhase("idle"); setError(null); }}
            className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const result = await action(...args);
                if (result.ok) {
                  router.push(redirectTo);
                  router.refresh();
                  return;
                }
                setError(result.error ?? "Something went wrong.");
              });
            }}
            className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
          >
            {isPending ? "…" : "Delete"}
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
      className="text-sm font-medium text-red-700 hover:underline"
    >
      {label}
    </button>
  );
}
