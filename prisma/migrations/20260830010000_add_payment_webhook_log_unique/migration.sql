-- CreateIndex
CREATE UNIQUE INDEX "PaymentWebhookLog_provider_externalEventId_key" ON "PaymentWebhookLog"("provider", "externalEventId");
