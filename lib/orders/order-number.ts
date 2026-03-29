import { createClient } from "@/lib/supabase/server";

/**
 * Generates a unique order number scoped to a tenant:
 * {SLUG}-{YYYY}-{NNNNN} e.g. BH-2026-00001
 */
export async function generateOrderNumber(tenantSlug: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${tenantSlug.toUpperCase()}-${year}-`;

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
