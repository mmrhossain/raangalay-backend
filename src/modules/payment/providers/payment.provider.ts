import type {
  PaymentMethod,
  PaymentTransactionStatus,
} from "../../../generated/prisma/enums.ts";

export interface ProviderOrderData {
  id: string;
  orderNumber: string;
  grandTotal: number;
  currency: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string | undefined;
  customerCity: string | undefined;
  customerPostCode: string | undefined;
  customerCountry: string | undefined;
  customerState: string | undefined;
}

export interface ProviderCallbackUrls {
  successUrl: string;
  failUrl: string;
  cancelUrl: string;
  ipnUrl: string;
}

export interface ProviderInitiateResult {
  checkoutUrl: string | null;
  providerReference: string;
  paymentStatus: PaymentTransactionStatus;
  expiresAt: Date | undefined;
}

export interface ProviderTransactionVerification {
  valid: boolean;
  providerReference: string;
  transactionId: string;
  amount: number | undefined;
  currency: string | undefined;
  raw: unknown;
}

export interface PaymentProvider {
  readonly method: PaymentMethod;
  initiate(
    order: ProviderOrderData,
    callbackUrls: ProviderCallbackUrls
  ): Promise<ProviderInitiateResult>;
  verifyTransaction(valId: string): Promise<ProviderTransactionVerification>;
  verifyWebhookSignature(payload: Record<string, string>): boolean;
}
