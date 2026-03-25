"use server";

import { revalidatePath } from "next/cache";
import { OrderStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { generateOrderNumber } from "@/lib/orders/order-number";
import { prisma } from "@/lib/prisma";
import { createOrderSchema } from "@/lib/validations/order";

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
  const rows = await prisma.serviceCategory.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      items: {
        where: { isActive: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        select: { id: true, name: true, defaultPrice: true },
      },
    },
  });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    allowsCustomPricing: c.allowsCustomPricing,
    items: c.items.map((i) => ({
      id: i.id,
      name: i.name,
      defaultPrice: i.defaultPrice.toNumber(),
    })),
  }));
}

export async function getMyOrdersForReception() {
  const session = await auth();
  if (!session?.user || session.user.role !== "RECEPTION") {
    return [];
  }

  const orders = await prisma.order.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      orderNumber: true,
      createdAt: true,
      totalAmount: true,
      orderStatus: true,
      notes: true,
      customerName: true,
      customerPhone: true,
      _count: { select: { items: true } },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    createdAt: o.createdAt,
    totalAmount: o.totalAmount.toString(),
    orderStatus: o.orderStatus,
    notes: o.notes,
    customerName: o.customerName,
    customerPhone: o.customerPhone,
    _count: { items: o._count.items },
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

  const categoryIds = [...new Set(items.map((i) => i.serviceCategoryId))];
  const categories = await prisma.serviceCategory.findMany({
    where: { id: { in: categoryIds }, isActive: true },
    select: { id: true, name: true, allowsCustomPricing: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));
  if (categories.length !== categoryIds.length) {
    return { ok: false, error: "One or more categories are invalid or inactive." };
  }

  const lines: {
    serviceCategoryId: string;
    categoryName: string;
    serviceItemId: string | null;
    itemName: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    lineTotal: Prisma.Decimal;
    sortOrder: number;
  }[] = [];

  let total = new Prisma.Decimal(0);

  for (let i = 0; i < items.length; i++) {
    const row = items[i];
    const cat = categoryMap.get(row.serviceCategoryId)!;

    if (row.kind === "custom") {
      if (!cat.allowsCustomPricing) {
        return { ok: false, error: `"${cat.name}" does not allow custom items.` };
      }
      const unitPrice = new Prisma.Decimal(String(row.unitPrice));
      const lineTotalI = unitPrice.mul(row.quantity);
      total = total.add(lineTotalI);
      lines.push({
        serviceCategoryId: cat.id,
        categoryName: cat.name,
        serviceItemId: null,
        itemName: row.customItemName.trim(),
        quantity: row.quantity,
        unitPrice,
        lineTotal: lineTotalI,
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

    const item = await prisma.serviceItem.findFirst({
      where: {
        id: row.serviceItemId,
        serviceCategoryId: cat.id,
        isActive: true,
      },
      select: { id: true, name: true, defaultPrice: true },
    });
    if (!item) {
      return { ok: false, error: "One or more items are invalid or inactive." };
    }

    const unitPrice = item.defaultPrice;
    const lineTotalI = unitPrice.mul(row.quantity);
    total = total.add(lineTotalI);
    lines.push({
      serviceCategoryId: cat.id,
      categoryName: cat.name,
      serviceItemId: item.id,
      itemName: item.name,
      quantity: row.quantity,
      unitPrice,
      lineTotal: lineTotalI,
      sortOrder: i,
    });
  }

  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const orderNumber = await generateOrderNumber(tx);

        // Use proper Prisma create with nested OrderItem creation.
        // Prisma handles ID generation via @default(cuid()) in the schema.
        const order = await tx.order.create({
          data: {
            orderNumber,
            createdById: session.user!.id,
            notes: notes?.trim() || null,
            totalAmount: total,
            orderStatus: "IN_PROGRESS",
            customerName,
            customerPhone,
            items: {
              create: lines.map((l) => ({
                serviceCategoryId: l.serviceCategoryId,
                categoryName: l.categoryName,
                serviceItemId: l.serviceItemId,
                itemName: l.itemName,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
                lineTotal: l.lineTotal,
                sortOrder: l.sortOrder,
              })),
            },
          },
          select: { id: true, orderNumber: true },
        });

        return order;
      });

      revalidatePath("/reception/orders");
      revalidatePath("/admin");
      return { ok: true, orderId: created.id, orderNumber: created.orderNumber };
    } catch (e: unknown) {
      const err = e as { code?: string; meta?: { target?: string[] } };
      const isOrderNumberCollision =
        err.code === "P2002" && err.meta?.target?.includes("orderNumber");
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

  const existing = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, createdById: true, orderStatus: true },
  });

  if (!existing || existing.createdById !== session.user.id) {
    return { ok: false, error: "Order not found." };
  }

  const current = existing.orderStatus;
  const allowed =
    (current === "IN_PROGRESS" && nextStatus === "READY") ||
    (current === "READY" && nextStatus === "PICKED_UP");

  if (!allowed) {
    return { ok: false, error: "Invalid status transition." };
  }

  try {
    await prisma.order.update({
      where: { id: orderId },
      data: { orderStatus: nextStatus },
    });
    revalidatePath("/reception/orders");
    return { ok: true };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Could not update status. Try again." };
  }
}
