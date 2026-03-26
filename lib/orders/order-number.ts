import { createClient } from "@/lib/supabase/server";

/**
 * Generates a unique order number: ORD-YYYY-NNNNN (sequential per calendar year).
 * Same logic as the original Prisma version.
 */
export async function generateOrderNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `ORD-${year}-`;

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("Order")
    .select("orderNumber")
    .like("orderNumber", `${prefix}%`)
    .order("orderNumber", { ascending: false })
    .limit(1)
    .single();

  let nextSeq = 1;
  if (last?.orderNumber) {
    const parts = last.orderNumber.split("-");
    const n = parseInt(parts[2] ?? "", 10);
    if (!Number.isNaN(n)) nextSeq = n + 1;
  }

  return `${prefix}${String(nextSeq).padStart(5, "0")}`;
}
