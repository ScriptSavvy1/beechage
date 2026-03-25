"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { OrderStatus } from "@prisma/client";
import { updateMyOrderStatus } from "@/lib/actions/orders";

export function OrderStatusActions({
  orderId,
  orderStatus,
}: {
  orderId: string;
  orderStatus: OrderStatus;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const nextStatus: OrderStatus | null =
    orderStatus === "IN_PROGRESS"
      ? "READY"
      : orderStatus === "READY"
        ? "PICKED_UP"
        : null;

  if (!nextStatus) return null;

  const label =
    nextStatus === "READY" ? "Mark READY" : nextStatus === "PICKED_UP" ? "Mark picked up" : "";

  return (
    <div className="flex justify-end">
      <div className="flex flex-col items-end gap-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const result = await updateMyOrderStatus({ orderId, nextStatus });
              if (result.ok) {
                router.refresh();
                return;
              }
              setError(result.error);
            });
          }}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-zinc-800 disabled:opacity-60"
        >
          {isPending ? "Updating…" : label}
        </button>
        {error ? <p className="text-xs text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}

