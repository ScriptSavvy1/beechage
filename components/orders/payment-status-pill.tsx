"use client";

import { PaymentStatus } from "@prisma/client";

const config: Record<PaymentStatus, { label: string; bg: string; text: string }> = {
  UNPAID: { label: "Unpaid", bg: "bg-red-50", text: "text-red-700" },
  PARTIALLY_PAID: { label: "Partial", bg: "bg-amber-50", text: "text-amber-700" },
  PAID: { label: "Paid", bg: "bg-emerald-50", text: "text-emerald-700" },
};

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  const c = config[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.bg} ${c.text}`}
    >
      {c.label}
    </span>
  );
}
