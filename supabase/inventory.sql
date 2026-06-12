-- ============================================================
-- Inventory & Resource Management Table Setup
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Create inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL, -- food, medical, clothing, education, others
  quantity TEXT NOT NULL, -- e.g., "500 kg", "20 boxes"
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  donor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  donor_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'distributed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- ── Inventory Policies ──

-- Everyone (authenticated users) can view inventory items
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON public.inventory;
CREATE POLICY "Authenticated users can view inventory"
  ON public.inventory FOR SELECT
  USING (auth.role() = 'authenticated');

-- Donors can insert into inventory (when donating items)
DROP POLICY IF EXISTS "Donors can insert into inventory" ON public.inventory;
CREATE POLICY "Donors can insert into inventory"
  ON public.inventory FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Only admins and trustees can manage inventory (insert, update, delete)
DROP POLICY IF EXISTS "Admins can manage inventory" ON public.inventory;
CREATE POLICY "Admins can manage inventory"
  ON public.inventory FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'trustee')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'trustee')
    )
  );
