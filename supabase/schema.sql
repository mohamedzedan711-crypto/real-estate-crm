-- ============================================================
-- Real Estate CRM — Full Database Schema
-- Run this in Supabase SQL Editor (Project → SQL Editor → New query)
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────
-- 1. PROFILES  (extends auth.users)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL CHECK (role IN ('admin','manager','agent')),
  manager_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  phone         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile row when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 2. LEADS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.leads (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name         TEXT NOT NULL,
  phone             TEXT NOT NULL,
  email             TEXT,
  source            TEXT NOT NULL DEFAULT 'manual'
                      CHECK (source IN ('olx_dubizzle','aqarmap','meta','whatsapp','manual')),
  type              TEXT NOT NULL DEFAULT 'buyer'
                      CHECK (type IN ('buyer','seller')),
  status            TEXT NOT NULL DEFAULT 'new'
                      CHECK (status IN ('new','contacted','interested','negotiating','closed_won','closed_lost')),
  -- Property details
  property_type     TEXT,
  property_area     TEXT,
  property_size     NUMERIC,          -- m²
  property_price    NUMERIC,          -- EGP
  property_location TEXT,
  -- Buyer details
  budget_min        NUMERIC,
  budget_max        NUMERIC,
  timeline          TEXT,
  preferred_area    TEXT,
  -- Meta
  notes             TEXT,
  ai_score          SMALLINT CHECK (ai_score BETWEEN 1 AND 10),
  is_dead           BOOLEAN NOT NULL DEFAULT FALSE,
  assigned_to       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- External source IDs (dedup)
  external_id       TEXT,             -- OLX/Aqarmap listing ID or Meta lead ID
  -- Timestamps
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_leads_status       ON public.leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source       ON public.leads(source);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to  ON public.leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_created_at   ON public.leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_external_id  ON public.leads(external_id) WHERE external_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 3. LEAD ACTIVITIES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.lead_activities (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id    UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  user_id    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  type       TEXT NOT NULL CHECK (type IN ('note','call','whatsapp_sent','whatsapp_recv','status_change','assignment','created')),
  content    TEXT NOT NULL,
  metadata   JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON public.lead_activities(lead_id);

-- ─────────────────────────────────────────────────────────────
-- 4. WHATSAPP MESSAGES
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lead_id       UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  direction     TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  message       TEXT NOT NULL,
  status        TEXT DEFAULT 'sent' CHECK (status IN ('sent','delivered','read','failed')),
  wa_message_id TEXT UNIQUE,          -- WhatsApp's own message ID
  sent_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_lead_id ON public.whatsapp_messages(lead_id);

-- ─────────────────────────────────────────────────────────────
-- 5. SETTINGS (encrypted API keys + system config)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.settings (
  key        TEXT PRIMARY KEY,
  value      TEXT,               -- stored as-is; sensitive keys are encrypted by Edge Function
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 6. AI CHAT SESSIONS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ai_chat_sessions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  messages   JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────
-- 7. SCRAPER LOGS
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.scraper_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source         TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('running','success','error')),
  leads_found    INTEGER DEFAULT 0,
  leads_created  INTEGER DEFAULT 0,
  error_message  TEXT,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at    TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────
-- 8. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_activities    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_logs       ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

-- Helper: is current user an admin or manager?
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT role IN ('admin','manager') FROM public.profiles WHERE id = auth.uid();
$$;

-- ── profiles ────────────────────────────────────────────────
-- Everyone can read profiles (needed for assignment dropdowns)
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (true);
-- Only admins can insert/update/delete
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (
  auth.uid() = id OR public.current_user_role() = 'admin'
);
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (public.current_user_role() = 'admin');

-- ── leads ───────────────────────────────────────────────────
-- Admin/Manager: all leads; Agent: only their assigned leads
CREATE POLICY "leads_select" ON public.leads FOR SELECT USING (
  public.is_admin_or_manager() OR assigned_to = auth.uid()
);
CREATE POLICY "leads_insert" ON public.leads FOR INSERT WITH CHECK (
  public.is_admin_or_manager() OR true  -- agents can also create leads manually
);
CREATE POLICY "leads_update" ON public.leads FOR UPDATE USING (
  public.is_admin_or_manager() OR assigned_to = auth.uid()
);
CREATE POLICY "leads_delete" ON public.leads FOR DELETE USING (
  public.current_user_role() = 'admin'  -- only admin can delete
);

-- ── lead_activities ─────────────────────────────────────────
CREATE POLICY "activities_select" ON public.lead_activities FOR SELECT USING (
  public.is_admin_or_manager() OR
  EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND assigned_to = auth.uid())
);
CREATE POLICY "activities_insert" ON public.lead_activities FOR INSERT WITH CHECK (
  public.is_admin_or_manager() OR
  EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND assigned_to = auth.uid())
);

-- ── whatsapp_messages ────────────────────────────────────────
CREATE POLICY "wa_select" ON public.whatsapp_messages FOR SELECT USING (
  public.is_admin_or_manager() OR
  EXISTS (SELECT 1 FROM public.leads WHERE id = lead_id AND assigned_to = auth.uid())
);
CREATE POLICY "wa_insert" ON public.whatsapp_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "wa_update" ON public.whatsapp_messages FOR UPDATE USING (true);

-- ── settings ────────────────────────────────────────────────
CREATE POLICY "settings_select" ON public.settings FOR SELECT USING (true);
CREATE POLICY "settings_insert" ON public.settings FOR INSERT WITH CHECK (public.current_user_role() = 'admin');
CREATE POLICY "settings_update" ON public.settings FOR UPDATE USING (public.current_user_role() = 'admin');
CREATE POLICY "settings_delete" ON public.settings FOR DELETE USING (public.current_user_role() = 'admin');

-- ── ai_chat_sessions ────────────────────────────────────────
CREATE POLICY "ai_chat_select" ON public.ai_chat_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "ai_chat_insert" ON public.ai_chat_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "ai_chat_update" ON public.ai_chat_sessions FOR UPDATE USING (user_id = auth.uid());

-- ── scraper_logs ────────────────────────────────────────────
CREATE POLICY "scraper_logs_select" ON public.scraper_logs FOR SELECT USING (public.is_admin_or_manager());
CREATE POLICY "scraper_logs_insert" ON public.scraper_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "scraper_logs_update" ON public.scraper_logs FOR UPDATE USING (true);

-- ─────────────────────────────────────────────────────────────
-- 9. REALTIME
-- ─────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.lead_activities;

-- ─────────────────────────────────────────────────────────────
-- 10. SEED: default settings
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.settings (key, value) VALUES
  ('scraper_frequency',    '6h'),
  ('wa_first_message',     'مرحباً بك! 👋 أنا مساعدك العقاري. كيف يمكنني مساعدتك اليوم؟ هل أنت مهتم بالشراء أم البيع؟'),
  ('wa_followup_days',     '3'),
  ('weekly_report_time',   '09:00')
ON CONFLICT (key) DO NOTHING;
