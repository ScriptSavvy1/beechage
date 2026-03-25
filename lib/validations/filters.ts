import { OrderStatus } from "@prisma/client";
import { z } from "zod";

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format (YYYY-MM-DD)");

export const receptionOrdersFilterSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  orderStatus: z.nativeEnum(OrderStatus).optional(),
  from: ymd.optional(),
  to: ymd.optional(),
});

export const adminExpenseFilterSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  categoryId: z.string().optional().default(""),
  userId: z.string().optional().default(""),
  from: ymd.optional(),
  to: ymd.optional(),
});

export function toDateRange(from?: string, to?: string): { from?: Date; to?: Date } {
  const range: { from?: Date; to?: Date } = {};
  if (from) {
    const d = new Date(`${from}T00:00:00.000`);
    if (!Number.isNaN(d.getTime())) range.from = d;
  }
  if (to) {
    const d = new Date(`${to}T23:59:59.999`);
    if (!Number.isNaN(d.getTime())) range.to = d;
  }
  return range;
}
