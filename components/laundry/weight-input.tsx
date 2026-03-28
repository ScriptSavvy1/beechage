"use client";

import { useState, useTransition } from "react";
import { recordWeight } from "@/lib/actions/orders";

export function WeightInput({
  orderId,
  itemId,
  initialWeight,
}: {
  orderId: string;
  itemId: string;
  initialWeight: number | null;
}) {
  const [value, setValue] = useState(initialWeight?.toString() ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSave = () => {
    setError(null);
    setSaved(false);
    const weightKg = value.trim() ? parseFloat(value) : null;

    if (weightKg !== null && (isNaN(weightKg) || weightKg <= 0)) {
      setError("Invalid weight");
      return;
    }

    startTransition(async () => {
      const result = await recordWeight({ orderId, itemId, weightKg });
      if (result.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error);
      }
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="number"
        step="0.01"
        min="0"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        placeholder="kg"
        disabled={isPending}
        className="w-20 rounded-md border border-zinc-300 px-2 py-1 text-right text-sm tabular-nums focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-60"
      />
      {saved && <span className="text-xs text-emerald-600">✓</span>}
      {error && <span className="text-xs text-red-600">!</span>}
    </div>
  );
}
