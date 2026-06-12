-- ============================================================
-- Logistics & Deliveries Setup Guide
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Create deliveries table
CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled', -- e.g., scheduled, in_transit, delivered, cancelled
  assigned_personnel TEXT DEFAULT 'Pending Assignment',
  destination TEXT DEFAULT 'Main Relief Center',
  estimated_delivery TIMESTAMPTZ,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Apply updated_at trigger to deliveries
DROP TRIGGER IF EXISTS deliveries_updated_at ON public.deliveries;
CREATE TRIGGER deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- 2. Create delivery checkpoints table
CREATE TABLE IF NOT EXISTS public.delivery_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- e.g., pending, completed
  checkpoint_time TIMESTAMPTZ DEFAULT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_checkpoints ENABLE ROW LEVEL SECURITY;

-- ── Deliveries Policies ──

-- Authenticated users can view delivery status
DROP POLICY IF EXISTS "Authenticated users can view deliveries" ON public.deliveries;
CREATE POLICY "Authenticated users can view deliveries"
  ON public.deliveries FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins and trustees can manage deliveries (create, update, delete)
DROP POLICY IF EXISTS "Admins can manage deliveries" ON public.deliveries;
CREATE POLICY "Admins can manage deliveries"
  ON public.deliveries FOR ALL
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

-- ── Delivery Checkpoints Policies ──

-- Authenticated users can view checkpoints
DROP POLICY IF EXISTS "Authenticated users can view checkpoints" ON public.delivery_checkpoints;
CREATE POLICY "Authenticated users can view checkpoints"
  ON public.delivery_checkpoints FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins and trustees can manage checkpoints (create, update, delete)
DROP POLICY IF EXISTS "Admins can manage checkpoints" ON public.delivery_checkpoints;
CREATE POLICY "Admins can manage checkpoints"
  ON public.delivery_checkpoints FOR ALL
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
