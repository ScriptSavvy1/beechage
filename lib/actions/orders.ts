/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { createClient } from "@/lib/supabase/server";
import { createOrderSchema, updateOrderSchema } from "@/lib/validations/order";
import { OrderStatus, PaymentStatus, PricingType } from "@/lib/types/enums";

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; error: string };

export type ServiceCatalogCategory = {
  id: string;
  name: string;
  allowsCustomPricing: boolean;
  items: { id: string; name: string; defaultPrice: number; pricingType: string }[];
};

export async function getServiceCatalogForReception(): Promise<ServiceCatalogCategory[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "RECEPTION") {
    return [];
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("ServiceCategory")
    .select("id, name, allowsCustomPricing, items:ServiceItem(id, name, defaultPrice, pricingType, isActive, sortOrder)")
    .eq("isActive", true)
    .order("sortOrder", { ascending: true })
    .order("name", { ascending: true });

  if (!rows) return [];

  return rows.map((c: any) => {
    const activeItems = (c.items || [])
      .filter((i: any) => i.isActive)
      .sort((a: any, b: any) => {
        if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
        return a.name.localeCompare(b.name);
      });

    return {
      id: c.id,
      name: c.name,
      allowsCustomPricing: c.allowsCustomPricing,
      items: activeItems.map((i: any) => ({
        id: i.id,
        name: i.name,
        defaultPrice: Number(i.defaultPrice),
        pricingType: i.pricingType || "FIXED",
      })),
    };
  });
}

export type OrderFilters = {
  q?: string;
  orderStatus?: string;
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
};

export async function getMyOrdersForReception(filters: OrderFilters = {}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "RECEPTION") {
    return [];
  }

  const supabase = await createClient();
  let query = supabase
    .from("Order")
    .select(`
      id,
      orderNumber,
      createdAt,
      totalAmount,
      paidAmount,
      paymentStatus,
      orderStatus,
      notes,
      customerName,
      customerPhone,
      items:OrderItem(count)
    `)
    .eq("createdById", session.user.id);

  if (filters.orderStatus) {
    query = query.eq("orderStatus", filters.orderStatus);
  }
  if (filters.from) {
    query = query.gte("createdAt", `${filters.from}T00:00:00.000Z`);
  }
  if (filters.to) {
    query = query.lte("createdAt", `${filters.to}T23:59:59.999Z`);
  }
  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      query = query.or(`orderNumber.ilike.%${q}%,notes.ilike.%${q}%,customerName.ilike.%${q}%`);
    }
  }

  const { data: orders } = await query.order("createdAt", { ascending: false });

  if (!orders) return [];

  return orders.map((o: any) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: new Date(o.createdAt),
    totalAmount: { toNumber: () => Number(o.totalAmount), toString: () => String(o.totalAmount) },
    paidAmount: { toNumber: () => Number(o.paidAmount), toString: () => String(o.paidAmount) },
    paymentStatus: o.paymentStatus as PaymentStatus,
    orderStatus: o.orderStatus as OrderStatus,
    notes: o.notes,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    _count: { items: o.items[0]?.count || 0 },
  }));
}

// ─── Shared helper: resolve items from input ────────────────────
async function resolveOrderLines(
  items: any[],
  supabase: any,
) {
  const categoryIds = [...new Set(items.map((i) => i.serviceCategoryId))];

  const { data: categories } = await supabase
    .from("ServiceCategory")
    .select("id, name, allowsCustomPricing")
    .in("id", categoryIds)
    .eq("isActive", true);

  if (!categories || categories.length !== categoryIds.length) {
    return { ok: false as const, error: "One or more categories are invalid or inactive." };
  }
  const categoryMap = new Map<string, { id: string; name: string; allowsCustomPricing: boolean }>(
    categories.map((c: any) => [c.id, c])
  );

  const lines: any[] = [];
  let fixedTotal = 0;
  let hasPerKg = false;

  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    const cat = categoryMap.get(row.serviceCategoryId)!;

    if (row.kind === "custom") {
      if (!cat.allowsCustomPricing) {
        return { ok: false as const, error: `"${cat.name}" does not allow custom items.` };
      }
      const unitPrice = Number(row.unitPrice);
      const lineTotal = unitPrice * row.quantity;
      fixedTotal += lineTotal;
      lines.push({
        serviceCategoryId: cat.id,
        categoryName: cat.name,
        serviceItemId: null,
        itemName: row.customItemName.trim(),
        quantity: row.quantity,
        unitPrice,
        lineTotal,
        pricingType: PricingType.FIXED,
        sortOrder: i,
      });
      continue;
    }

    if (cat.allowsCustomPricing) {
      return {
        ok: false as const,
        error: `Use custom item name and price for category "${cat.name}".`,
      };
    }

    const { data: item } = await supabase
      .from("ServiceItem")
      .select("id, name, defaultPrice, pricingType")
      .eq("id", row.serviceItemId)
      .eq("serviceCategoryId", cat.id)
      .eq("isActive", true)
      .single();

    if (!item) {
      return { ok: false as const, error: "One or more items are invalid or inactive." };
    }

    const pricingType = item.pricingType || PricingType.FIXED;
    const unitPrice = Number(item.defaultPrice);

    if (pricingType === PricingType.PER_KG) {
      // Per KG: lineTotal = 0 until weighed by laundry, quantity forced to 1
      hasPerKg = true;
      lines.push({
        serviceCategoryId: cat.id,
        categoryName: cat.name,
        serviceItemId: item.id,
        itemName: item.name,
        quantity: 1,
        unitPrice, // this is the rate per KG
        lineTotal: 0,
        pricingType: PricingType.PER_KG,
        sortOrder: i,
      });
    } else {
      // Fixed: normal calculation
      const lineTotal = unitPrice * row.quantity;
      fixedTotal += lineTotal;
      lines.push({
        serviceCategoryId: cat.id,
        categoryName: cat.name,
        serviceItemId: item.id,
        itemName: item.name,
        quantity: row.quantity,
        unitPrice,
        lineTotal,
        pricingType: PricingType.FIXED,
        sortOrder: i,
      });
    }
  }

  return { ok: true as const, lines, fixedTotal, hasPerKg };
}

export async function createOrder(input: unknown): Promise<CreateOrderResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "RECEPTION") {
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      Object.values(first).flat()[0] ??
      parsed.error.errors[0]?.message ??
      "Invalid form data.";
    return { ok: false, error: msg };
  }

  const { notes, customerName, customerPhone, items } = parsed.data;

  const supabase = await createClient();
  const resolved = await resolveOrderLines(items, supabase);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const { lines, fixedTotal } = resolved;

  // Retry loop for order number collisions (same as original)
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const orderNumber = await generateOrderNumber();

      const { data: order, error: orderError } = await supabase
        .from("Order")
        .insert({
          orderNumber,
          createdById: session.user.id,
          notes: notes?.trim() || null,
          totalAmount: fixedTotal, // Only fixed items for now; KG items add 0
          orderStatus: OrderStatus.IN_PROGRESS,
          paymentStatus: PaymentStatus.UNPAID,
          customerName,
          customerPhone,
        })
        .select("id, orderNumber")
        .single();

      if (orderError) throw orderError;

      // Insert items
      const linesToInsert = lines.map(l => ({ ...l, orderId: order.id }));
      const { error: itemsError } = await supabase
        .from("OrderItem")
        .insert(linesToInsert);

      if (itemsError) {
        // Rollback: delete the order if items failed
        await supabase.from("Order").delete().eq("id", order.id);
        throw itemsError;
      }

      revalidatePath("/reception/orders");
      revalidatePath("/admin");
      revalidatePath("/laundry/orders");
      return { ok: true, orderId: order.id, orderNumber: order.orderNumber };

    } catch (e: any) {
      const isOrderNumberCollision = e.code === "23505" && e.message?.includes("orderNumber");
      if (isOrderNumberCollision && attempt < maxAttempts - 1) continue;
      console.error(e);
      return { ok: false, error: "Could not save the order. Please try again." };
    }
  }

  return { ok: false, error: "Could not assign a unique order number." };
}

// ─── Update Order (Edit) ──────────────────────────────────────

export type UpdateOrderResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateOrder(input: unknown): Promise<UpdateOrderResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "RECEPTION") {
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = updateOrderSchema.safeParse(input);
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors;
    const msg =
      Object.values(first).flat()[0] ??
      parsed.error.errors[0]?.message ??
      "Invalid form data.";
    return { ok: false, error: msg };
  }

  const { orderId, notes, customerName, customerPhone, items } = parsed.data;

  const supabase = await createClient();

  // Verify ownership and status
  const { data: existing } = await supabase
    .from("Order")
    .select("id, createdById, orderStatus")
    .eq("id", orderId)
    .single();

  if (!existing || existing.createdById !== session.user.id) {
    return { ok: false, error: "Order not found." };
  }

  if (existing.orderStatus !== OrderStatus.IN_PROGRESS) {
    return { ok: false, error: "Only in-progress orders can be edited." };
  }

  const resolved = await resolveOrderLines(items, supabase);
  if (!resolved.ok) return { ok: false, error: resolved.error };

  const { lines, fixedTotal } = resolved;

  try {
    // Delete old items
    const { error: deleteError } = await supabase
      .from("OrderItem")
      .delete()
      .eq("orderId", orderId);

    if (deleteError) throw deleteError;

    // Insert new items
    const linesToInsert = lines.map(l => ({ ...l, orderId }));
    const { error: itemsError } = await supabase
      .from("OrderItem")
      .insert(linesToInsert);

    if (itemsError) throw itemsError;

    // Update order header
    const { error: updateError } = await supabase
      .from("Order")
      .update({
        notes: notes?.trim() || null,
        customerName,
        customerPhone,
        totalAmount: fixedTotal,
      })
      .eq("id", orderId);

    if (updateError) throw updateError;

    revalidatePath("/reception/orders");
    revalidatePath(`/reception/orders/${orderId}`);
    revalidatePath("/laundry/orders");
    revalidatePath(`/laundry/orders/${orderId}`);
    revalidatePath("/admin");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not update the order. Please try again." };
  }
}

// ─── Status Updates ──────────────────────────────────────────

const updateOrderStatusSchema = z.object({
  orderId: z.string().min(1, "Order id is required"),
  nextStatus: z.nativeEnum(OrderStatus),
});

export type UpdateOrderStatusResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateMyOrderStatus(input: unknown): Promise<UpdateOrderStatusResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "RECEPTION") {
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = updateOrderStatusSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }

  const { orderId, nextStatus } = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("Order")
    .select("id, createdById, orderStatus")
    .eq("id", orderId)
    .single();

  if (!existing || existing.createdById !== session.user.id) {
    return { ok: false, error: "Order not found." };
  }

  // Reception can only mark READY → PICKED_UP
  // (Laundry handles IN_PROGRESS → READY)
  const allowed = existing.orderStatus === OrderStatus.READY && nextStatus === OrderStatus.PICKED_UP;

  if (!allowed) {
    return { ok: false, error: "Invalid status transition." };
  }

  try {
    const { error } = await supabase
      .from("Order")
      .update({ orderStatus: nextStatus })
      .eq("id", orderId);

    if (error) throw error;

    revalidatePath("/reception/orders");
    revalidatePath("/laundry/orders");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not update status. Try again." };
  }
}

// ─── Payment ─────────────────────────────────────────────────

const recordPaymentSchema = z.object({
  orderId: z.string().min(1),
  amount: z.number().positive("Amount must be greater than 0"),
});

export type RecordPaymentResult =
  | { ok: true }
  | { ok: false; error: string };

export async function recordPayment(input: unknown): Promise<RecordPaymentResult> {
  const session = await auth();
  if (!session?.user?.id || session.user.role !== "RECEPTION") {
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = recordPaymentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }

  const { orderId, amount } = parsed.data;

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("Order")
    .select("id, createdById, totalAmount, paidAmount, orderStatus")
    .eq("id", orderId)
    .single();

  if (!order || order.createdById !== session.user.id) {
    return { ok: false, error: "Order not found." };
  }

  // Block payment if order has unfinalized KG items (still IN_PROGRESS)
  if (order.orderStatus === OrderStatus.IN_PROGRESS) {
    // Check if there are any PER_KG items
    const { data: kgItems } = await supabase
      .from("OrderItem")
      .select("id")
      .eq("orderId", orderId)
      .eq("pricingType", "PER_KG")
      .limit(1);

    if (kgItems && kgItems.length > 0) {
      return { ok: false, error: "Cannot record payment: order has per-KG items awaiting weight measurement." };
    }
  }

  const totalAmount = Number(order.totalAmount);
  const paidAmount = Number(order.paidAmount);

  const remaining = totalAmount - paidAmount;
  if (amount > remaining + 0.001) {
    return { ok: false, error: `Amount exceeds remaining balance ($${remaining.toFixed(2)}).` };
  }

  const newPaid = paidAmount + amount;
  const paymentStatus = newPaid >= totalAmount ? PaymentStatus.PAID
    : newPaid > 0 ? PaymentStatus.PARTIALLY_PAID
    : PaymentStatus.UNPAID;

  try {
    const { error } = await supabase
      .from("Order")
      .update({ paidAmount: newPaid, paymentStatus })
      .eq("id", orderId);

    if (error) throw error;

    revalidatePath("/reception/orders");
    revalidatePath(`/reception/orders/${orderId}`);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not record payment. Try again." };
  }
}

// ─── Order Detail ────────────────────────────────────────────

export async function getOrderById(orderId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("Order")
    .select(`
      *,
      items:OrderItem(*, serviceCategory:ServiceCategory(name)),
      createdBy:users(name, email)
    `)
    .eq("id", orderId)
    .single();

  if (!order) return null;

  // Sort items by sortOrder (to match Prisma's orderBy)
  if (order.items) {
    order.items.sort((a: any, b: any) => a.sortOrder - b.sortOrder);
  }

  // Reception can only view their own orders
  if (session.user.role === "RECEPTION" && order.createdById !== session.user.id) {
    return null;
  }

  // Check if order has any PER_KG items without weight
  const hasPendingKg = order.items.some(
    (i: any) => i.pricingType === "PER_KG" && (i.weightKg == null || Number(i.weightKg) <= 0)
  );

  // Return Prisma-compatible shape with Decimal-like objects
  return {
    ...order,
    totalAmount: { toNumber: () => Number(order.totalAmount), toString: () => String(order.totalAmount) },
    paidAmount: { toNumber: () => Number(order.paidAmount), toString: () => String(order.paidAmount) },
    createdAt: new Date(order.createdAt),
    createdBy: Array.isArray(order.createdBy) ? order.createdBy[0] : order.createdBy,
    hasPendingKg,
    items: order.items.map((i: any) => ({
      ...i,
      pricingType: i.pricingType || "FIXED",
      weightKg: i.weightKg != null ? Number(i.weightKg) : null,
      unitPrice: { toNumber: () => Number(i.unitPrice), toString: () => String(i.unitPrice) },
      lineTotal: { toNumber: () => Number(i.lineTotal), toString: () => String(i.lineTotal) },
    })),
  };
}

// ─── Laundry Actions ──────────────────────────────────────────

export type LaundryFilters = {
  q?: string;
  status?: string; // "IN_PROGRESS" | "READY" | ""
};

export async function getOrdersForLaundry(filters: LaundryFilters = {}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LAUNDRY") return [];

  const supabase = await createClient();
  let query = supabase
    .from("Order")
    .select("id, orderNumber, customerName, customerPhone, totalAmount, orderStatus, createdAt, items:OrderItem(id, pricingType, weightKg)");

  // Default: show IN_PROGRESS and READY
  if (filters.status) {
    query = query.eq("orderStatus", filters.status);
  } else {
    query = query.in("orderStatus", ["IN_PROGRESS", "READY"]);
  }

  if (filters.q) {
    const q = filters.q.trim();
    if (q) {
      query = query.or(`orderNumber.ilike.%${q}%,customerName.ilike.%${q}%`);
    }
  }

  const { data } = await query.order("createdAt", { ascending: false });
  if (!data) return [];

  return data.map((o: any) => {
    const hasPerKg = o.items?.some((i: any) => i.pricingType === "PER_KG");
    const hasPendingKg = o.items?.some(
      (i: any) => i.pricingType === "PER_KG" && (i.weightKg == null || Number(i.weightKg) <= 0)
    );
    return {
      ...o,
      totalAmount: { toNumber: () => Number(o.totalAmount), toString: () => String(o.totalAmount) },
      createdAt: new Date(o.createdAt),
      _count: { items: o.items?.length ?? 0 },
      hasPerKg,
      hasPendingKg,
    };
  });
}

export async function getOrderByIdForLaundry(orderId: string) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LAUNDRY") return null;

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("Order")
    .select(`
      *,
      createdBy:users(name, email),
      items:OrderItem(*)
    `)
    .eq("id", orderId)
    .single();

  if (!order) return null;

  const hasUnweighedKgItems = order.items.some(
    (i: any) => (i.pricingType === "PER_KG") && (i.weightKg == null || Number(i.weightKg) <= 0)
  );

  return {
    ...order,
    totalAmount: { toNumber: () => Number(order.totalAmount), toString: () => String(order.totalAmount) },
    paidAmount: { toNumber: () => Number(order.paidAmount), toString: () => String(order.paidAmount) },
    createdAt: new Date(order.createdAt),
    createdBy: Array.isArray(order.createdBy) ? order.createdBy[0] : order.createdBy,
    hasUnweighedKgItems,
    items: order.items.map((i: any) => ({
      ...i,
      pricingType: i.pricingType || "FIXED",
      unitPrice: { toNumber: () => Number(i.unitPrice), toString: () => String(i.unitPrice) },
      lineTotal: { toNumber: () => Number(i.lineTotal), toString: () => String(i.lineTotal) },
      weightKg: i.weightKg != null ? Number(i.weightKg) : null,
    })),
  };
}

const recordWeightSchema = z.object({
  orderId: z.string().min(1),
  itemId: z.string().min(1),
  weightKg: z.number().positive("Weight must be greater than 0").nullable(),
});

export async function recordWeight(input: unknown): Promise<UpdateOrderStatusResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "LAUNDRY") {
    return { ok: false, error: "Unauthorized." };
  }

  const parsed = recordWeightSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0]?.message ?? "Invalid data." };
  }

  const { orderId, itemId, weightKg } = parsed.data;

  const supabase = await createClient();

  // Fetch the item to check pricing type
  const { data: item } = await supabase
    .from("OrderItem")
    .select("id, pricingType, unitPrice")
    .eq("id", itemId)
    .eq("orderId", orderId)
    .single();

  if (!item) {
    return { ok: false, error: "Item not found." };
  }

  try {
    const updateData: any = { weightKg };

    // For PER_KG items, recalculate lineTotal when weight changes
    if (item.pricingType === PricingType.PER_KG && weightKg != null) {
      updateData.lineTotal = Number(item.unitPrice) * weightKg;
    }

    const { error } = await supabase
      .from("OrderItem")
      .update(updateData)
      .eq("id", itemId)
      .eq("orderId", orderId);

    if (error) throw error;

    revalidatePath(`/laundry/orders/${orderId}`);
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not save weight." };
  }
}

export async function markOrderReady(orderId: string): Promise<UpdateOrderStatusResult> {
  const session = await auth();
  if (!session?.user || session.user.role !== "LAUNDRY") {
    return { ok: false, error: "Unauthorized." };
  }

  const supabase = await createClient();
  const { data: order } = await supabase
    .from("Order")
    .select("id, orderStatus")
    .eq("id", orderId)
    .single();

  if (!order) return { ok: false, error: "Order not found." };
  if (order.orderStatus !== OrderStatus.IN_PROGRESS) {
    return { ok: false, error: "Order is not in progress." };
  }

  // Fetch all items to validate weights and recalculate total
  const { data: items } = await supabase
    .from("OrderItem")
    .select("id, pricingType, unitPrice, lineTotal, weightKg")
    .eq("orderId", orderId);

  if (!items) return { ok: false, error: "Could not load order items." };

  // Check all PER_KG items have weight
  const unweighed = items.filter(
    (i: any) => i.pricingType === "PER_KG" && (i.weightKg == null || Number(i.weightKg) <= 0)
  );

  if (unweighed.length > 0) {
    return { ok: false, error: `${unweighed.length} per-KG item(s) still need to be weighed.` };
  }

  // Recalculate total from all items
  let newTotal = 0;
  for (const item of items) {
    if (item.pricingType === "PER_KG") {
      // Use weight × rate
      const calculated = Number(item.unitPrice) * Number(item.weightKg);
      newTotal += calculated;
    } else {
      newTotal += Number(item.lineTotal);
    }
  }

  try {
    const { error } = await supabase
      .from("Order")
      .update({ orderStatus: OrderStatus.READY, totalAmount: newTotal })
      .eq("id", orderId);

    if (error) throw error;

    revalidatePath("/laundry/orders");
    revalidatePath(`/laundry/orders/${orderId}`);
    revalidatePath("/reception/orders");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not update status." };
  }
}
