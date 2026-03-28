/* eslint-disable @typescript-eslint/no-explicit-any */
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { createClient } from "@/lib/supabase/server";
import { createOrderSchema } from "@/lib/validations/order";
import { OrderStatus, PaymentStatus } from "@/lib/types/enums";

export type CreateOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; error: string };

export type ServiceCatalogCategory = {
  id: string;
  name: string;
  allowsCustomPricing: boolean;
  items: { id: string; name: string; defaultPrice: number }[];
};

export async function getServiceCatalogForReception(): Promise<ServiceCatalogCategory[]> {
  const session = await auth();
  if (!session?.user || session.user.role !== "RECEPTION") {
    return [];
  }

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("ServiceCategory")
    .select("id, name, allowsCustomPricing, items:ServiceItem(id, name, defaultPrice, isActive, sortOrder)")
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

  // Return shape matching original Prisma output
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
  const categoryIds = [...new Set(items.map((i) => i.serviceCategoryId))];

  const { data: categories } = await supabase
    .from("ServiceCategory")
    .select("id, name, allowsCustomPricing")
    .in("id", categoryIds)
    .eq("isActive", true);

  if (!categories || categories.length !== categoryIds.length) {
    return { ok: false, error: "One or more categories are invalid or inactive." };
  }
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const lines: any[] = [];
  let total = 0;

  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    const cat = categoryMap.get(row.serviceCategoryId)!;

    if (row.kind === "custom") {
      if (!cat.allowsCustomPricing) {
        return { ok: false, error: `"${cat.name}" does not allow custom items.` };
      }
      const unitPrice = Number(row.unitPrice);
      const lineTotal = unitPrice * row.quantity;
      total += lineTotal;
      lines.push({
        serviceCategoryId: cat.id,
        categoryName: cat.name,
        serviceItemId: null,
        itemName: row.customItemName.trim(),
        quantity: row.quantity,
        unitPrice,
        lineTotal,
        sortOrder: i,
      });
      continue;
    }

    if (cat.allowsCustomPricing) {
      return {
        ok: false,
        error: `Use custom item name and price for category "${cat.name}".`,
      };
    }

    const { data: item } = await supabase
      .from("ServiceItem")
      .select("id, name, defaultPrice")
      .eq("id", row.serviceItemId)
      .eq("serviceCategoryId", cat.id)
      .eq("isActive", true)
      .single();

    if (!item) {
      return { ok: false, error: "One or more items are invalid or inactive." };
    }

    const unitPrice = Number(item.defaultPrice);
    const lineTotal = unitPrice * row.quantity;
    total += lineTotal;
    lines.push({
      serviceCategoryId: cat.id,
      categoryName: cat.name,
      serviceItemId: item.id,
      itemName: item.name,
      quantity: row.quantity,
      unitPrice,
      lineTotal,
      sortOrder: i,
    });
  }

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
          totalAmount: total,
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
    .select("id, createdById, totalAmount, paidAmount")
    .eq("id", orderId)
    .single();

  if (!order || order.createdById !== session.user.id) {
    return { ok: false, error: "Order not found." };
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

  // Return Prisma-compatible shape with Decimal-like objects
  return {
    ...order,
    totalAmount: { toNumber: () => Number(order.totalAmount), toString: () => String(order.totalAmount) },
    paidAmount: { toNumber: () => Number(order.paidAmount), toString: () => String(order.paidAmount) },
    createdAt: new Date(order.createdAt),
    createdBy: Array.isArray(order.createdBy) ? order.createdBy[0] : order.createdBy,
    items: order.items.map((i: any) => ({
      ...i,
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
    .select("id, orderNumber, customerName, customerPhone, totalAmount, orderStatus, createdAt, items:OrderItem(id)");

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

  return data.map((o: any) => ({
    ...o,
    totalAmount: { toNumber: () => Number(o.totalAmount), toString: () => String(o.totalAmount) },
    createdAt: new Date(o.createdAt),
    _count: { items: o.items?.length ?? 0 },
  }));
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

  return {
    ...order,
    totalAmount: { toNumber: () => Number(order.totalAmount), toString: () => String(order.totalAmount) },
    paidAmount: { toNumber: () => Number(order.paidAmount), toString: () => String(order.paidAmount) },
    createdAt: new Date(order.createdAt),
    createdBy: Array.isArray(order.createdBy) ? order.createdBy[0] : order.createdBy,
    items: order.items.map((i: any) => ({
      ...i,
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
  try {
    const { error } = await supabase
      .from("OrderItem")
      .update({ weightKg })
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

  try {
    const { error } = await supabase
      .from("Order")
      .update({ orderStatus: OrderStatus.READY })
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
