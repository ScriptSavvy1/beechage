import { describe, it, expect } from "vitest";
import { createOrderSchema, orderLineInputSchema } from "./order";

describe("orderLineInputSchema", () => {
  it("accepts a valid catalog line", () => {
    const result = orderLineInputSchema.safeParse({
      kind: "catalog",
      serviceCategoryId: "cat-1",
      serviceItemId: "item-1",
      quantity: 2,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid custom line", () => {
    const result = orderLineInputSchema.safeParse({
      kind: "custom",
      serviceCategoryId: "cat-other",
      customItemName: "Special garment",
      unitPrice: 5.0,
      quantity: 1,
    });
    expect(result.success).toBe(true);
  });

  it("rejects catalog line without serviceItemId", () => {
    const result = orderLineInputSchema.safeParse({
      kind: "catalog",
      serviceCategoryId: "cat-1",
      serviceItemId: "",
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects custom line without customItemName", () => {
    const result = orderLineInputSchema.safeParse({
      kind: "custom",
      serviceCategoryId: "cat-other",
      customItemName: "",
      unitPrice: 5.0,
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero quantity", () => {
    const result = orderLineInputSchema.safeParse({
      kind: "catalog",
      serviceCategoryId: "cat-1",
      serviceItemId: "item-1",
      quantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative custom price", () => {
    const result = orderLineInputSchema.safeParse({
      kind: "custom",
      serviceCategoryId: "cat-other",
      customItemName: "Item",
      unitPrice: -3,
      quantity: 1,
    });
    expect(result.success).toBe(false);
  });
});

describe("createOrderSchema", () => {
  const validCatalogLine = {
    kind: "catalog" as const,
    serviceCategoryId: "cat-1",
    serviceItemId: "item-1",
    quantity: 2,
  };

  it("accepts a valid order", () => {
    const result = createOrderSchema.safeParse({
      customerName: "John Doe",
      customerPhone: "+252 612345678",
      items: [validCatalogLine],
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing customerName", () => {
    const result = createOrderSchema.safeParse({
      customerName: "",
      customerPhone: "+252 612345678",
      items: [validCatalogLine],
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing customerPhone", () => {
    const result = createOrderSchema.safeParse({
      customerName: "John Doe",
      customerPhone: "",
      items: [validCatalogLine],
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid phone characters", () => {
    const result = createOrderSchema.safeParse({
      customerName: "John Doe",
      customerPhone: "abc-not-a-phone",
      items: [validCatalogLine],
    });
    expect(result.success).toBe(false);
  });

  it("rejects phone with fewer than 7 digits", () => {
    const result = createOrderSchema.safeParse({
      customerName: "John Doe",
      customerPhone: "123",
      items: [validCatalogLine],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty items array", () => {
    const result = createOrderSchema.safeParse({
      customerName: "John Doe",
      customerPhone: "+252 612345678",
      items: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional notes", () => {
    const result = createOrderSchema.safeParse({
      customerName: "John Doe",
      customerPhone: "+252 612345678",
      notes: "Fragile items",
      items: [validCatalogLine],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.notes).toBe("Fragile items");
    }
  });

  it("accepts null notes", () => {
    const result = createOrderSchema.safeParse({
      customerName: "John Doe",
      customerPhone: "+252 612345678",
      notes: null,
      items: [validCatalogLine],
    });
    expect(result.success).toBe(true);
  });
});
