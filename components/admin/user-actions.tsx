"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteUser, deactivateUser } from "@/lib/actions/admin-users";

export function UserActions({ userId, isActive }: { userId: string; isActive: boolean }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "confirmDelete" | "confirmDeactivate">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleAction = (action: (id: string) => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const result = await action(userId);
      if (result.ok) {
        setPhase("idle");
        router.refresh();
        return;
      }
      setError(result.error ?? "Something went wrong.");
    });
  };

  if (phase === "confirmDelete") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600">Delete?</span>
        <button
          disabled={isPending}
          onClick={() => setPhase("idle")}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:opacity-60"
        >
          No
        </button>
        <button
          disabled={isPending}
          onClick={() => handleAction(deleteUser)}
          className="rounded bg-red-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {isPending ? "…" : "Yes"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  if (phase === "confirmDeactivate") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600">Deactivate?</span>
        <button
          disabled={isPending}
          onClick={() => setPhase("idle")}
          className="rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-50 disabled:opacity-60"
        >
          No
        </button>
        <button
          disabled={isPending}
          onClick={() => handleAction(deactivateUser)}
          className="rounded bg-amber-600 px-2 py-0.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {isPending ? "…" : "Yes"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex items-center justify-end gap-3">
      {isActive && (
        <button
          onClick={() => setPhase("confirmDeactivate")}
          className="text-xs font-medium text-amber-700 hover:underline"
        >
          Deactivate
        </button>
      )}
      <button
        onClick={() => setPhase("confirmDelete")}
        className="text-xs font-medium text-red-700 hover:underline"
      >
        Delete
      </button>
    </div>
  );
}
