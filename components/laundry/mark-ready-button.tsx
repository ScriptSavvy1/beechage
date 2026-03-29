"use client";

import { useState, useTransition } from "react";
import { markOrderReady } from "@/lib/actions/orders";

type Props = {
  orderId: string;
  hasUnweighedKgItems?: boolean;
};

export function MarkReadyButton({ orderId, hasUnweighedKgItems = false }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const disabled = isPending || hasUnweighedKgItems;

  function onClick() {
    setError(null);
    startTransition(async () => {
      const result = await markOrderReady(orderId);
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Marking…" : "✓ Mark Ready"}
      </button>

      {hasUnweighedKgItems && (
        <p className="max-w-[200px] text-right text-[11px] text-amber-700">
          ⚖️ All per-KG items must be weighed first
        </p>
      )}

      {error && (
        <p className="max-w-[200px] text-right text-xs text-red-600">{error}</p>
      )}
    </div>
  );
}
