import type { Prisma } from "@prisma/client";

/**
 * Generates a unique order number: ORD-YYYY-NNNNN (sequential per calendar year).
 * Retries on rare collision (P2002).
 */
export async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  const last = await tx.order.findFirst({
    where: { orderNumber: { startsWith: prefix } },
    orderBy: { orderNumber: "desc" },
    select: { orderNumber: true },
  });

  let nextSeq = 1;
  if (last?.orderNumber) {
    const parts = last.orderNumber.split("-");
    const n = parseInt(parts[2] ?? "", 10);
    if (!Number.isNaN(n)) nextSeq = n + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}
