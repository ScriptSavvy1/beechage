"use client";

import { useState } from "react";
import { recordPayment, applyDiscount } from "@/lib/actions/orders";

type Props = {
  orderId: string;
  remaining: number;
  currentDiscount: number;
  totalAmount: number;
};

export function RecordPaymentForm({ orderId, remaining, currentDiscount, totalAmount }: Props) {
  const [amount, setAmount] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [showDiscount, setShowDiscount] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
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

  const handleDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsPending(true);
    const result = await applyDiscount({ orderId, discount: parseFloat(discountAmount) });
    setIsPending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDiscountAmount("");
    setShowDiscount(false);
  };

  return (
    <div className="space-y-2">
      {/* Payment form */}
      {remaining > 0 && (
        <form onSubmit={handlePayment} className="flex items-center gap-2">
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
        </form>
      )}

      {/* Discount toggle & form */}
      {currentDiscount > 0 && (
        <p className="text-xs text-amber-700">
          Discount applied: <span className="font-semibold">${currentDiscount.toFixed(2)}</span>
        </p>
      )}

      {!showDiscount ? (
        <button
          onClick={() => setShowDiscount(true)}
          className="text-xs font-medium text-amber-700 hover:underline"
        >
          {currentDiscount > 0 ? "Edit discount" : "Apply discount"}
        </button>
      ) : (
        <form onSubmit={handleDiscount} className="flex items-center gap-2">
          <input
            type="number"
            step="0.01"
            min="0"
            max={totalAmount}
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            placeholder={currentDiscount > 0 ? `Current: $${currentDiscount.toFixed(2)}` : "Discount amount"}
            className="w-28 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs"
            required
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {isPending ? "…" : "Apply"}
          </button>
          <button
            type="button"
            onClick={() => { setShowDiscount(false); setDiscountAmount(""); }}
            className="text-xs text-zinc-500 hover:underline"
          >
            Cancel
          </button>
        </form>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
