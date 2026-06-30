-- ── Run this in your Supabase SQL Editor ────────────────────────────────────

-- 1. financial_entries table
CREATE TABLE IF NOT EXISTS financial_entries (
  id                 UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  type               TEXT         NOT NULL CHECK (type IN ('income', 'expense')),
  category           TEXT         NOT NULL,
  amount             NUMERIC(15,2) NOT NULL CHECK (amount > 0),
  description        TEXT,
  property_reference TEXT,
  entry_date         DATE         NOT NULL DEFAULT CURRENT_DATE,
  created_by         UUID         REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  ai_parsed_summary  TEXT,
  confirmed          BOOLEAN      DEFAULT TRUE
);

ALTER TABLE financial_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manager_entries_all" ON financial_entries
  FOR ALL TO authenticated
  USING (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  )
  WITH CHECK (
    (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'manager')
  );

-- 2. Add page_access column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS page_access JSONB DEFAULT NULL;

-- 3. Seed starting_capital setting (no-op if already exists)
INSERT INTO settings (key, value, updated_at)
VALUES ('starting_capital', '0', NOW())
ON CONFLICT (key) DO NOTHING;
