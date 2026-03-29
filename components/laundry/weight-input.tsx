"use client";

import { useState, useTransition } from "react";
import { recordWeight } from "@/lib/actions/orders";
import { formatCurrency } from "@/lib/format";

type Props = {
  orderId: string;
  itemId: string;
  initialWeight: number | null;
  pricingType?: string;
  unitPrice?: number;
};

export function WeightInput({ orderId, itemId, initialWeight, pricingType = "FIXED", unitPrice = 0 }: Props) {
  const [weight, setWeight] = useState(initialWeight?.toString() ?? "");
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  const isPerKg = pricingType === "PER_KG";
  const numWeight = parseFloat(weight) || 0;
  const calculatedTotal = isPerKg && numWeight > 0 ? numWeight * unitPrice : null;

  function save() {
    const w = parseFloat(weight);
    if (!weight.trim() || isNaN(w) || w <= 0) return;
    setSaved(false);
    startTransition(async () => {
      const result = await recordWeight({ orderId, itemId, weightKg: w });
      if (result.ok) setSaved(true);
    });
  }

  return (
    <div className={`flex flex-col gap-1 ${isPerKg ? "items-end" : "items-end"}`}>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0.001}
          step={0.001}
          value={weight}
          onChange={(e) => {
            setWeight(e.target.value);
            setSaved(false);
          }}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }}
          disabled={isPending}
          className={`w-24 rounded-lg border px-2 py-1.5 text-right text-sm tabular-nums outline-none focus:ring-2 ${
            isPerKg
              ? "border-blue-300 ring-blue-400 bg-blue-50/50"
              : "border-zinc-300 ring-zinc-400"
          } ${isPending ? "opacity-50" : ""}`}
          placeholder="kg"
        />
        <span className="text-xs text-zinc-400">kg</span>
      </div>

      {/* Show calculated price for PER_KG items */}
      {isPerKg && calculatedTotal !== null && (
        <span className="text-xs font-medium text-blue-700">
          = {formatCurrency(calculatedTotal)}
        </span>
      )}

      {isPerKg && !weight.trim() && (
        <span className="text-[10px] font-medium text-red-500">Required</span>
      )}

      {saved && (
        <span className="text-[10px] font-medium text-emerald-600">✓ Saved</span>
      )}
    </div>
  );
}
