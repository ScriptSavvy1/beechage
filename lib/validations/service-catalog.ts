import { z } from "zod";

export const serviceCategoryFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  sortOrder: z.coerce.number().int().min(0),
  allowsCustomPricing: z.boolean(),
  isActive: z.boolean(),
});

export const updateServiceCategorySchema = serviceCategoryFormSchema.extend({
  id: z.string().min(1),
});

export const serviceItemFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  defaultPrice: z.coerce.number().positive("Price must be greater than zero"),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
});

export const updateServiceItemSchema = serviceItemFormSchema.extend({
  id: z.string().min(1),
  serviceCategoryId: z.string().min(1),
});

export type ServiceCategoryFormInput = z.infer<typeof serviceCategoryFormSchema>;
export type ServiceItemFormInput = z.infer<typeof serviceItemFormSchema>;
