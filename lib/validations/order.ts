import { z } from "zod";

const catalogLineSchema = z.object({
  kind: z.literal("catalog"),
  serviceCategoryId: z.string().min(1, "Select a category"),
  serviceItemId: z.string().min(1, "Select an item"),
  quantity: z.coerce.number().int().min(1, "Min quantity is 1"),
});

const customLineSchema = z.object({
  kind: z.literal("custom"),
  serviceCategoryId: z.string().min(1, "Select a category"),
  customItemName: z.string().trim().min(1, "Item name is required").max(200),
  unitPrice: z.coerce.number().positive("Price must be greater than zero"),
  quantity: z.coerce.number().int().min(1, "Min quantity is 1"),
});

export const orderLineInputSchema = z.discriminatedUnion("kind", [catalogLineSchema, customLineSchema]);

export const createOrderSchema = z.object({
  notes: z.string().max(2000).optional().nullable(),
  customerName: z.string().trim().min(1, "Customer name is required").max(120),
  customerPhone: z
    .string()
    .trim()
    .min(1, "Customer phone is required")
    .max(30, "Customer phone is too long")
    .regex(/^[0-9+\-()\s]+$/, "Phone contains invalid characters")
    .refine((s) => s.replace(/\D/g, "").length >= 7, "Phone must include at least 7 digits"),
  items: z.array(orderLineInputSchema).min(1, "Add at least one line item"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderLineInput = z.infer<typeof orderLineInputSchema>;
