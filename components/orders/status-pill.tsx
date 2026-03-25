import type { OrderStatus } from "@prisma/client";

const orderStyles: Record<OrderStatus, string> = {
  IN_PROGRESS: "bg-amber-50 text-amber-900 ring-amber-200",
  READY: "bg-sky-50 text-sky-900 ring-sky-200",
  PICKED_UP: "bg-emerald-50 text-emerald-900 ring-emerald-200",
};

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${orderStyles[status]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
