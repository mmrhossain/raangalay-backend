import { z } from "zod";

export const paymentMethodSchema = z.enum(["COD", "SSLCOMMERZ"]);

export const initiatePaymentSchema = z.object({
  method: paymentMethodSchema,
});

export type InitiatePaymentInput = z.infer<typeof initiatePaymentSchema>;

export const refundSchema = z.object({
  amount: z.coerce.number().positive().multipleOf(0.01),
  reason: z.string().max(500).optional(),
});

export type RefundInput = z.infer<typeof refundSchema>;

export const sslcommerzSuccessSchema = z
  .object({
    val_id: z.string().min(1),
    tran_id: z.string().min(1),
  })
  .passthrough();

export type SslcommerzSuccessInput = z.infer<typeof sslcommerzSuccessSchema>;

export const sslcommerzFailCancelSchema = z
  .object({
    tran_id: z.string().min(1),
  })
  .passthrough();

export type SslcommerzFailCancelInput = z.infer<
  typeof sslcommerzFailCancelSchema
>;

export const sslcommerzIpnSchema = z
  .object({
    val_id: z.string().min(1),
    tran_id: z.string().min(1),
    verify_sign: z.string().min(1),
  })
  .passthrough();

export type SslcommerzIpnInput = z.infer<typeof sslcommerzIpnSchema>;
