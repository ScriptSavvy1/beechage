import { z } from "zod";

export const createReceptionUserSchema = z.object({
  email: z.string().trim().email("Valid email required"),
  name: z.string().trim().max(120).optional().nullable(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["RECEPTION", "LAUNDRY"]),
});

export type CreateReceptionUserInput = z.infer<typeof createReceptionUserSchema>;
