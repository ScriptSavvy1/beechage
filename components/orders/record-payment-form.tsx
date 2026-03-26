"use client";

import { useState } from "react";
import { recordPayment } from "@/lib/actions/orders";

type Props = {
  orderId: string;
  remaining: number;
};

export function RecordPaymentForm({ orderId, remaining }: Props) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const result = await recordPayment({ orderId, amount: parseFloat(amount) });
    setIsPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAmount("");
  };

  if (remaining <= 0) return null;

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="number"
        step="0.01"
        min="0.01"
        max={remaining}
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder={`Max $${remaining.toFixed(2)}`}
        className="w-28 rounded-md border border-zinc-300 px-2 py-1 text-xs"
        required
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-emerald-700 px-2.5 py-1 text-xs font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {isPending ? "…" : "Pay"}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
