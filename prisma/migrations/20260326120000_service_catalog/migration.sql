-- Service catalog (replaces ItemCategory). Clears orders/lines (dev-safe; totals would be inconsistent otherwise).

CREATE TABLE "ServiceCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "allowsCustomPricing" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "ServiceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ServiceCategory_name_key" ON "ServiceCategory"("name");

CREATE TABLE "ServiceItem" (
    "id" TEXT NOT NULL,
    "serviceCategoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "defaultPrice" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServiceItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ServiceItem_serviceCategoryId_idx" ON "ServiceItem"("serviceCategoryId");

CREATE UNIQUE INDEX "ServiceItem_serviceCategoryId_name_key" ON "ServiceItem"("serviceCategoryId", "name");

ALTER TABLE "ServiceItem" ADD CONSTRAINT "ServiceItem_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- OrderStatus: only IN_PROGRESS | READY | PICKED_UP
CREATE TYPE "OrderStatus_new" AS ENUM ('IN_PROGRESS', 'READY', 'PICKED_UP');

ALTER TABLE "Order" ALTER COLUMN "orderStatus" DROP DEFAULT;

ALTER TABLE "Order" ALTER COLUMN "orderStatus" TYPE "OrderStatus_new" USING (
  CASE "orderStatus"::text
    WHEN 'IN_PROGRESS' THEN 'IN_PROGRESS'::"OrderStatus_new"
    WHEN 'READY' THEN 'READY'::"OrderStatus_new"
    WHEN 'PICKED_UP' THEN 'PICKED_UP'::"OrderStatus_new"
    WHEN 'COMPLETED' THEN 'PICKED_UP'::"OrderStatus_new"
    WHEN 'PENDING' THEN 'IN_PROGRESS'::"OrderStatus_new"
    WHEN 'CANCELLED' THEN 'IN_PROGRESS'::"OrderStatus_new"
    ELSE 'IN_PROGRESS'::"OrderStatus_new"
  END
);

ALTER TABLE "Order" ALTER COLUMN "orderStatus" SET DEFAULT 'IN_PROGRESS'::"OrderStatus_new";

DROP TYPE "OrderStatus";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";

-- Remove payment
ALTER TABLE "Order" DROP COLUMN "paymentStatus";
DROP TYPE "PaymentStatus";

-- Replace order line shape (drop old FK + column; clear rows first)
DELETE FROM "OrderItem";
DELETE FROM "Order";

ALTER TABLE "OrderItem" DROP CONSTRAINT "OrderItem_itemCategoryId_fkey";
DROP TABLE "ItemCategory";

ALTER TABLE "OrderItem" DROP COLUMN "itemCategoryId";

ALTER TABLE "OrderItem" ADD COLUMN "serviceCategoryId" TEXT NOT NULL;
ALTER TABLE "OrderItem" ADD COLUMN "serviceItemId" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "itemName" TEXT NOT NULL DEFAULT '';

ALTER TABLE "OrderItem" ALTER COLUMN "itemName" DROP DEFAULT;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_serviceCategoryId_fkey" FOREIGN KEY ("serviceCategoryId") REFERENCES "ServiceCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_serviceItemId_fkey" FOREIGN KEY ("serviceItemId") REFERENCES "ServiceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
