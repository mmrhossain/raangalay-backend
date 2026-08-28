-- DropIndex
DROP INDEX "StockReservation_orderId_key";

-- CreateIndex
CREATE INDEX "StockReservation_orderId_idx" ON "StockReservation"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "StockReservation_orderId_variantId_warehouseId_key" ON "StockReservation"("orderId", "variantId", "warehouseId");
