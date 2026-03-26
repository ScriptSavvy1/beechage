-- =====================================================
-- BeecHage Supabase Schema
-- Matches the original Prisma schema exactly
-- =====================================================

-- ─── Public users table (synced from auth.users via trigger) ──
CREATE TABLE IF NOT EXISTS public.users (
  id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email      TEXT UNIQUE NOT NULL,
  name       TEXT,
  role       TEXT NOT NULL DEFAULT 'RECEPTION' CHECK (role IN ('ADMIN', 'RECEPTION')),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all users (needed for dashboard filters, createdBy joins)
CREATE POLICY "Authenticated can read users" ON public.users
  FOR SELECT TO authenticated USING (true);

-- Allow service_role full access (for admin user creation)
CREATE POLICY "Service role full access" ON public.users
  FOR ALL TO service_role USING (true);

-- ─── Trigger: auto-create public.users row when auth.users is created ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, "isActive")
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NULL),
    COALESCE(NEW.raw_user_meta_data->>'role', 'RECEPTION'),
    true
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── Expense Categories ──
CREATE TABLE IF NOT EXISTS public."ExpenseCategory" (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  "sortOrder" INT NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(name)
);

ALTER TABLE public."ExpenseCategory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read ExpenseCategory" ON public."ExpenseCategory"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service role full ExpenseCategory" ON public."ExpenseCategory"
  FOR ALL TO service_role USING (true);
CREATE POLICY "Authenticated can manage ExpenseCategory" ON public."ExpenseCategory"
  FOR ALL TO authenticated USING (true);

-- ─── Expenses ──
CREATE TABLE IF NOT EXISTS public."Expense" (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "expenseCategoryId" UUID NOT NULL REFERENCES public."ExpenseCategory"(id),
  "categoryName"      TEXT NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  "expenseDate"       DATE NOT NULL,
  description         TEXT,
  "createdById"       UUID NOT NULL REFERENCES public.users(id),
  "createdAt"         TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_date ON public."Expense"("expenseDate");
CREATE INDEX IF NOT EXISTS idx_expense_created_by ON public."Expense"("createdById");
CREATE INDEX IF NOT EXISTS idx_expense_category ON public."Expense"("expenseCategoryId");

ALTER TABLE public."Expense" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage Expense" ON public."Expense"
  FOR ALL TO authenticated USING (true);

-- ─── Service Categories ──
CREATE TABLE IF NOT EXISTS public."ServiceCategory" (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  "sortOrder"           INT NOT NULL DEFAULT 0,
  "isActive"            BOOLEAN NOT NULL DEFAULT true,
  "allowsCustomPricing" BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(name)
);

ALTER TABLE public."ServiceCategory" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read ServiceCategory" ON public."ServiceCategory"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage ServiceCategory" ON public."ServiceCategory"
  FOR ALL TO authenticated USING (true);

-- ─── Service Items ──
CREATE TABLE IF NOT EXISTS public."ServiceItem" (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "serviceCategoryId" UUID NOT NULL REFERENCES public."ServiceCategory"(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  "defaultPrice"      NUMERIC(12,2) NOT NULL,
  "sortOrder"         INT NOT NULL DEFAULT 0,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  UNIQUE("serviceCategoryId", name)
);

CREATE INDEX IF NOT EXISTS idx_service_item_category ON public."ServiceItem"("serviceCategoryId");

ALTER TABLE public."ServiceItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read ServiceItem" ON public."ServiceItem"
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage ServiceItem" ON public."ServiceItem"
  FOR ALL TO authenticated USING (true);

-- ─── Orders ──
CREATE TABLE IF NOT EXISTS public."Order" (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderNumber"   TEXT UNIQUE NOT NULL,
  "createdById"   UUID NOT NULL REFERENCES public.users(id),
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes           TEXT,
  "customerName"  TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "totalAmount"   NUMERIC(12,2) NOT NULL,
  "paidAmount"    NUMERIC(12,2) NOT NULL DEFAULT 0,
  "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID' CHECK ("paymentStatus" IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
  "orderStatus"   TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK ("orderStatus" IN ('IN_PROGRESS', 'READY', 'PICKED_UP'))
);

CREATE INDEX IF NOT EXISTS idx_order_created_by ON public."Order"("createdById");
CREATE INDEX IF NOT EXISTS idx_order_created_at ON public."Order"("createdAt");

ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage Order" ON public."Order"
  FOR ALL TO authenticated USING (true);

-- ─── Order Items ──
CREATE TABLE IF NOT EXISTS public."OrderItem" (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "orderId"           UUID NOT NULL REFERENCES public."Order"(id) ON DELETE CASCADE,
  "serviceCategoryId" UUID NOT NULL REFERENCES public."ServiceCategory"(id),
  "categoryName"      TEXT NOT NULL,
  "serviceItemId"     UUID REFERENCES public."ServiceItem"(id) ON DELETE SET NULL,
  "itemName"          TEXT NOT NULL,
  quantity            INT NOT NULL,
  "unitPrice"         NUMERIC(12,2) NOT NULL,
  "lineTotal"         NUMERIC(12,2) NOT NULL,
  "sortOrder"         INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_order_item_order ON public."OrderItem"("orderId");
CREATE INDEX IF NOT EXISTS idx_order_item_category ON public."OrderItem"("serviceCategoryId");
CREATE INDEX IF NOT EXISTS idx_order_item_service ON public."OrderItem"("serviceItemId");

ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage OrderItem" ON public."OrderItem"
  FOR ALL TO authenticated USING (true);
