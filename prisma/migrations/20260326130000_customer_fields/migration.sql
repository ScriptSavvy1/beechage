-- Add reception customer details to orders
-- Default empty strings for safety when adding NOT NULL columns.

ALTER TABLE "Order"
  ADD COLUMN "customerName" TEXT NOT NULL DEFAULT '',
  ADD COLUMN "customerPhone" TEXT NOT NULL DEFAULT '';

