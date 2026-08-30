import { z } from "zod";

export const initiatePaymentSchema = z.object({
  method: z.enum(["COD"]),
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;
