"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { markOrderReady } from "@/lib/actions/orders";

export function MarkReadyButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<"idle" | "confirm">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (phase === "confirm") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600">Mark ready?</span>
        <button
          disabled={isPending}
          onClick={() => { setPhase("idle"); setError(null); }}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await markOrderReady(orderId);
              if (result.ok) {
                router.refresh();
                return;
              }
              setError(result.error);
            });
          }}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {isPending ? "…" : "Confirm"}
        </button>
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setPhase("confirm")}
      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-700"
    >
      ✓ Mark Ready
    </button>
  );
}
