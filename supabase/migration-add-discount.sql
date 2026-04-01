-- =====================================================
-- BeecHage: Add discount column to Order table
-- Run this in Supabase SQL Editor
-- =====================================================

ALTER TABLE public."Order"
  ADD COLUMN IF NOT EXISTS discount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Add a comment for documentation
COMMENT ON COLUMN public."Order".discount IS 'Discount amount applied by reception. Deducted from totalAmount for revenue calculations.';
