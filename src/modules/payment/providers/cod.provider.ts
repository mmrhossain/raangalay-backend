import type {
  ProviderCallbackUrls,
  PaymentProvider,
  ProviderOrderData,
} from "./payment.provider.ts";

export const codProvider: PaymentProvider = {
  method: "COD",

  async initiate(_order: ProviderOrderData, _callbacks: ProviderCallbackUrls) {
    return {
      checkoutUrl: null,
      providerReference: "",
      paymentStatus: "PENDING",
      expiresAt: undefined,
    };
  },

  async verifyTransaction() {
    return {
      valid: false,
      providerReference: "",
      transactionId: "",
      amount: undefined,
      currency: undefined,
      raw: null,
    };
  },

  verifyWebhookSignature() {
    return false;
  },
};
