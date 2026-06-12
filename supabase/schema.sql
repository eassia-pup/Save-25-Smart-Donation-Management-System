-- ============================================================
-- Save 25 Smart Donation Management System — Supabase Database Schema
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ──────────────────────────────────────────────
-- 1. CUSTOM TYPES & ENUMS
-- ──────────────────────────────────────────────

-- User roles: donor, admin, trustee
DO $$ BEGIN
  CREATE TYPE public.user_role AS ENUM ('donor', 'admin', 'trustee');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Donation payment method
DO $$ BEGIN
  CREATE TYPE public.donation_method AS ENUM ('credit_card', 'debit_card');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- In-kind donation categories
DO $$ BEGIN
  CREATE TYPE public.inkind_type AS ENUM (
    'relief_goods',
    'new_clothes',
    'medicine',
    'essential_goods'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Campaign status
DO $$ BEGIN
  CREATE TYPE public.campaign_status AS ENUM ('active', 'paused', 'completed', 'cancelled', 'postponed');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ──────────────────────────────────────────────
-- 2. PROFILES TABLE (extends auth.users)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role public.user_role NOT NULL DEFAULT 'donor',
  phone TEXT,
  address_unit TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  address_city TEXT,
  address_state TEXT,
  address_zip TEXT,
  address_country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ensure all address columns exist
DO $$ 
BEGIN
  BEGIN ALTER TABLE public.profiles ADD COLUMN address_unit TEXT; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.profiles ADD COLUMN address_line1 TEXT; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.profiles ADD COLUMN address_line2 TEXT; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.profiles ADD COLUMN address_city TEXT; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.profiles ADD COLUMN address_state TEXT; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.profiles ADD COLUMN address_zip TEXT; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.profiles ADD COLUMN address_country TEXT; EXCEPTION WHEN duplicate_column THEN END;
  BEGIN ALTER TABLE public.profiles DROP COLUMN address; EXCEPTION WHEN undefined_column THEN END;
END $$;

-- Auto-create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', ''),
    'donor'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ──────────────────────────────────────────────
-- 3. CAMPAIGNS TABLE
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL UNIQUE,
  short_description TEXT NOT NULL,
  full_description TEXT NOT NULL,
  image_url TEXT,
  category TEXT NOT NULL DEFAULT 'General',
  goal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (goal >= 0),
  raised NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (raised >= 0),
  donor_count INTEGER NOT NULL DEFAULT 0 CHECK (donor_count >= 0),
  start_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  end_date TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 days'),
  status public.campaign_status NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS campaigns_updated_at ON public.campaigns;
CREATE TRIGGER campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ──────────────────────────────────────────────
-- 4. DONATIONS TABLE (Credit / Debit Card)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method public.donation_method NOT NULL,
  cardholder_name TEXT NOT NULL,
  card_last_four TEXT,
  billing_address TEXT,
  contact_number TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- After a cash donation, increment raised amount and donor count on campaigns
CREATE OR REPLACE FUNCTION public.handle_donation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.campaigns
  SET
    raised = raised + NEW.amount,
    donor_count = donor_count + 1
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_donation_created ON public.donations;
CREATE TRIGGER on_donation_created
  AFTER INSERT ON public.donations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_donation_insert();

-- ──────────────────────────────────────────────
-- 5. IN-KIND DONATIONS TABLE
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inkind_donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  donor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  donor_name TEXT NOT NULL,
  inkind_type public.inkind_type NOT NULL,
  amount_description TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  address TEXT NOT NULL,
  ra_4653_compliance BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- After an in-kind donation, increment the campaign donor count
CREATE OR REPLACE FUNCTION public.handle_inkind_donation_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.campaigns
  SET donor_count = donor_count + 1
  WHERE id = NEW.campaign_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_inkind_donation_created ON public.inkind_donations;
CREATE TRIGGER on_inkind_donation_created
  AFTER INSERT ON public.inkind_donations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_inkind_donation_insert();

-- ──────────────────────────────────────────────
-- 6. INVENTORY TABLE
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL,
  category TEXT NOT NULL,
  quantity TEXT NOT NULL,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  donor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  donor_name TEXT,
  status TEXT NOT NULL DEFAULT 'in_stock' CHECK (status IN ('in_stock', 'distributed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 7. DELIVERIES TABLE (Logistics)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'scheduled',
  assigned_personnel TEXT DEFAULT 'Pending Assignment',
  destination TEXT DEFAULT 'Main Relief Center',
  estimated_delivery TIMESTAMPTZ,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS deliveries_updated_at ON public.deliveries;
CREATE TRIGGER deliveries_updated_at
  BEFORE UPDATE ON public.deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ──────────────────────────────────────────────
-- 8. DELIVERY CHECKPOINTS TABLE
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.delivery_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID NOT NULL REFERENCES public.deliveries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  checkpoint_time TIMESTAMPTZ DEFAULT NULL,
  order_index INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────
-- 9. HELPER FUNCTIONS & POLICIES SETUP
-- ──────────────────────────────────────────────

-- Function to check if a user is an admin or trustee without causing recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND (role = 'admin' OR role = 'trustee')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

-- Function to check if an email exists in profiles (for Find Account page)
CREATE OR REPLACE FUNCTION public.check_email_exists(email_to_check TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles WHERE email = email_to_check
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

GRANT EXECUTE ON FUNCTION public.check_email_exists(TEXT) TO anon, authenticated;

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inkind_donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_checkpoints ENABLE ROW LEVEL SECURITY;

-- ── Profiles Policies ──
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles"
  ON public.profiles FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete all profiles" ON public.profiles;
CREATE POLICY "Admins can delete all profiles"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- ── Campaigns Policies ──
DROP POLICY IF EXISTS "Authenticated users can view active campaigns" ON public.campaigns;
CREATE POLICY "Authenticated users can view active campaigns"
  ON public.campaigns FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage campaigns" ON public.campaigns;
CREATE POLICY "Admins can manage campaigns"
  ON public.campaigns FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Donations Policies ──
DROP POLICY IF EXISTS "Donors can create own donations" ON public.donations;
CREATE POLICY "Donors can create own donations"
  ON public.donations FOR INSERT
  WITH CHECK (auth.uid() = donor_id);

DROP POLICY IF EXISTS "Donors can view own donations" ON public.donations;
CREATE POLICY "Donors can view own donations"
  ON public.donations FOR SELECT
  USING (auth.uid() = donor_id);

DROP POLICY IF EXISTS "Admins can view all donations" ON public.donations;
CREATE POLICY "Admins can view all donations"
  ON public.donations FOR SELECT
  USING (public.is_admin());

-- ── In-Kind Donations Policies ──
DROP POLICY IF EXISTS "Donors can create own inkind donations" ON public.inkind_donations;
CREATE POLICY "Donors can create own inkind donations"
  ON public.inkind_donations FOR INSERT
  WITH CHECK (auth.uid() = donor_id);

DROP POLICY IF EXISTS "Donors can view own inkind donations" ON public.inkind_donations;
CREATE POLICY "Donors can view own inkind donations"
  ON public.inkind_donations FOR SELECT
  USING (auth.uid() = donor_id);

DROP POLICY IF EXISTS "Admins can view all inkind donations" ON public.inkind_donations;
CREATE POLICY "Admins can view all inkind donations"
  ON public.inkind_donations FOR SELECT
  USING (public.is_admin());

-- ── Inventory Policies ──
DROP POLICY IF EXISTS "Authenticated users can view inventory" ON public.inventory;
CREATE POLICY "Authenticated users can view inventory"
  ON public.inventory FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Donors can insert into inventory" ON public.inventory;
CREATE POLICY "Donors can insert into inventory"
  ON public.inventory FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage inventory" ON public.inventory;
CREATE POLICY "Admins can manage inventory"
  ON public.inventory FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Deliveries Policies ──
DROP POLICY IF EXISTS "Authenticated users can view deliveries" ON public.deliveries;
CREATE POLICY "Authenticated users can view deliveries"
  ON public.deliveries FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage deliveries" ON public.deliveries;
CREATE POLICY "Admins can manage deliveries"
  ON public.deliveries FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ── Delivery Checkpoints Policies ──
DROP POLICY IF EXISTS "Authenticated users can view checkpoints" ON public.delivery_checkpoints;
CREATE POLICY "Authenticated users can view checkpoints"
  ON public.delivery_checkpoints FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admins can manage checkpoints" ON public.delivery_checkpoints;
CREATE POLICY "Admins can manage checkpoints"
  ON public.delivery_checkpoints FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ──────────────────────────────────────────────
-- 10. SEED DATA — Sample Campaigns
-- ──────────────────────────────────────────────

INSERT INTO public.campaigns (title, short_description, full_description, image_url, category, goal, raised, donor_count, start_date, end_date, status)
VALUES
  (
    'Typhoon Yolanda Relief Fund',
    'Help families recover from the devastating typhoon. Your donation provides food, shelter, and essential supplies to affected communities.',
    'Typhoon Yolanda left thousands of families displaced, with homes destroyed and livelihoods shattered. This campaign aims to provide immediate relief in the form of food packs, clean drinking water, temporary shelters, and hygiene kits. Every peso donated goes directly to on-the-ground operations coordinated with local government units and accredited NGOs. Our target is to reach 5,000 families across the Visayas region within the next 60 days. We are also working on long-term rehabilitation plans including livelihood programs and school rebuilding. Together, we can help these communities rise again and rebuild stronger than before. All disbursements are audited and transparent reports are published monthly.',
    '/img/campaign-disaster-relief.png',
    'Disaster Relief',
    2000000, 1250000, 847, now(), now() + interval '23 days',
    'active'
  ),
  (
    'Scholars of Hope: Education Fund',
    'Provide scholarships and school supplies to underprivileged students across Mindanao. Every child deserves access to quality education.',
    'Education is the most powerful weapon we can use to change the world. The Scholars of Hope program supports underprivileged students in remote barangays of Mindanao by providing full scholarships covering tuition, books, uniforms, and school supplies. We partner with local schools and community leaders to identify deserving students from families earning below the poverty threshold. This campaign also funds the construction of small community libraries and after-school tutoring programs staffed by volunteer teachers. Last year, we successfully supported 200 scholars — this year, our goal is to double that number. Your donation directly funds a child''s future and helps break the cycle of poverty. Quarterly progress reports with student updates are shared with all donors.',
    '/img/campaign-education.png',
    'Education',
    1500000, 780000, 523, now(), now() + interval '45 days',
    'active'
  ),
  (
    'Community Medical Mission',
    'Free medical checkups, medicines, and health services for underserved communities in rural Philippines.',
    'Access to healthcare remains a challenge for many Filipinos, especially those in remote rural areas where the nearest hospital can be hours away. Our Community Medical Mission brings volunteer doctors, nurses, dentists, and pharmacists directly to underserved barangays. Each mission provides free consultations, basic laboratory tests, dental extractions, minor surgical procedures, and a full supply of prescription medicines. We also conduct health education seminars on nutrition, hygiene, and disease prevention. This campaign funds the transportation, medical supplies, equipment, and meals for our volunteer medical teams. We conduct missions twice a month, each serving an average of 300-500 patients. Your donation helps save lives and brings hope to communities that need it most.',
    '/img/campaign-medical.png',
    'Healthcare',
    800000, 450000, 312, now(), now() + interval '30 days',
    'active'
  ),
  (
    'Build a Home, Build a Dream',
    'Help us construct safe, durable homes for families living in makeshift shelters. Every family deserves a roof over their heads.',
    'Thousands of Filipino families live in makeshift shelters made of scrap wood, tin sheets, and tarpaulins — structures that offer little protection from storms and flooding. Our housing program constructs simple yet durable concrete homes using a community-based approach where future homeowners participate in the building process. Each home costs approximately ₱150,000 and includes basic sanitation facilities. We work closely with local government units for land allocation and building permits. Since our founding, we have built 85 homes across Luzon and the Visayas. This campaign aims to build 20 additional homes in the next 6 months. Donors receive photo updates throughout the construction process and are invited to turnover ceremonies. Your generosity builds more than a house — it builds a family''s future.',
    '/img/campaign-housing.png',
    'Housing',
    3000000, 2100000, 1205, now(), now() + interval '60 days',
    'active'
  ),
  (
    'Feeding Program: Nourish the Future',
    'Daily nutritious meals for malnourished children and elderly in urban poor communities. No one should go hungry.',
    'Malnutrition remains one of the most pressing health issues facing Filipino children, particularly in urban poor communities. Our Nourish the Future feeding program provides daily nutritious meals to children aged 2-12 and senior citizens aged 60 and above in identified communities across Metro Manila and surrounding provinces. Each meal is carefully planned by a licensed nutritionist to ensure it meets the dietary needs of our beneficiaries. We operate 12 feeding centers staffed by community volunteers, serving an average of 1,500 meals per day. This campaign funds ingredients, cooking equipment, kitchen facilities, and volunteer training. We also conduct monthly nutritional assessments to track the health improvements of our beneficiaries. In our first year, we saw a 40% reduction in malnutrition rates among regular program participants.',
    '/img/campaign-feeding.png',
    'Feeding Program',
    1200000, 920000, 678, now(), now() + interval '15 days',
    'active'
  ),
  (
    'Green Philippines: Plant a Tree Today',
    'Join our reforestation and coastal cleanup drive. Help restore the Philippines'' natural ecosystems for future generations.',
    'The Philippines has lost over 70% of its original forest cover due to illegal logging, mining, and agricultural expansion. Our Green Philippines initiative combines reforestation with coastal and river cleanup operations to restore the country''s natural ecosystems. We plant native tree species such as narra, molave, and mangrove in deforested areas and eroding coastlines. Each tree planted costs approximately ₱50 including seedling, planting, and two years of maintenance. Our cleanup drives remove tons of plastic waste from rivers and coastlines monthly, preventing ocean pollution and protecting marine life. We partner with local communities, schools, and corporate volunteers, creating environmental awareness while providing livelihood opportunities for community tree caretakers. This campaign aims to plant 100,000 trees and conduct 24 major cleanup drives within the year.',
    '/img/campaign-environment.png',
    'Environment',
    500000, 350000, 1432, now(), now() + interval '90 days',
    'active'
  )
ON CONFLICT (title) DO NOTHING;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
