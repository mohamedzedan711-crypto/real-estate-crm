# Deployment Guide — Real Estate CRM

## Prerequisites
- Node.js 18+ and npm
- Supabase account (project already created)
- Vercel account (for hosting the frontend)
- GitHub account (for source control)
- Supabase CLI (`npm install -g supabase`)

---

## Step 1 — Set up the Database

1. Open your Supabase project: https://supabase.com/dashboard
2. Go to **SQL Editor → New Query**
3. Copy the full contents of `supabase/schema.sql` and paste it, then click **Run**
4. Verify the tables were created in **Table Editor**

---

## Step 2 — Create the first Admin user

1. In Supabase, go to **Authentication → Users → Add User**
2. Enter email and password for the admin account
3. After creating, go to **SQL Editor** and run:

```sql
UPDATE public.profiles
SET role = 'admin', full_name = 'Your Name'
WHERE email = 'your-admin@example.com';
```

---

## Step 3 — Deploy Edge Functions

Install the Supabase CLI and log in:

```bash
npm install -g supabase
supabase login
supabase link --project-ref bjjjxfrcwaghzddcsdhj
```

Set Edge Function secrets (these are server-side only — never in frontend):

```bash
supabase secrets set ANTHROPIC_API_KEY=your-anthropic-key
supabase secrets set WHATSAPP_API_TOKEN=your-whatsapp-token
supabase secrets set WHATSAPP_PHONE_NUMBER_ID=your-phone-number-id
supabase secrets set WHATSAPP_VERIFY_TOKEN=real_estate_crm_verify
supabase secrets set META_APP_SECRET=your-meta-app-secret
```

Deploy all functions:

```bash
supabase functions deploy ai-chat
supabase functions deploy ai-score-leads
supabase functions deploy ai-report
supabase functions deploy whatsapp-webhook
supabase functions deploy whatsapp-send
supabase functions deploy whatsapp-welcome
supabase functions deploy weekly-report
supabase functions deploy scraper-runner
supabase functions deploy admin-create-user
```

---

## Step 4 — Configure Realtime

In Supabase, go to **Database → Replication** and ensure these tables have Realtime enabled:
- `whatsapp_messages`
- `leads`
- `lead_activities`

---

## Step 5 — Set up WhatsApp Webhook

1. Go to https://developers.facebook.com → Your App → WhatsApp → Configuration
2. Set the webhook URL to:
   `https://bjjjxfrcwaghzddcsdhj.supabase.co/functions/v1/whatsapp-webhook`
3. Set the Verify Token to: `real_estate_crm_verify`
4. Subscribe to the **messages** webhook field

---

## Step 6 — Set up Meta Lead Ads Webhook

1. Go to https://developers.facebook.com → Your App → Webhooks
2. Add webhook for **leadgen**:
   `https://bjjjxfrcwaghzddcsdhj.supabase.co/functions/v1/meta-webhook`
3. Verify token: `real_estate_crm_verify`

---

## Step 7 — Schedule Scraper (pg_cron)

In Supabase SQL Editor, enable pg_cron and schedule the scraper:

```sql
-- Enable pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Run scraper every 6 hours
SELECT cron.schedule(
  'scraper-6h',
  '0 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bjjjxfrcwaghzddcsdhj.supabase.co/functions/v1/scraper-runner',
    headers := '{"Authorization": "Bearer <your-service-role-key>"}'::jsonb
  );
  $$
);

-- AI scoring every 2 hours
SELECT cron.schedule(
  'ai-score-2h',
  '0 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bjjjxfrcwaghzddcsdhj.supabase.co/functions/v1/ai-score-leads',
    headers := '{"Authorization": "Bearer <your-service-role-key>"}'::jsonb
  );
  $$
);

-- Weekly report every Sunday at 9am Cairo time (UTC+3 = 6am UTC)
SELECT cron.schedule(
  'weekly-report',
  '0 6 * * 0',
  $$
  SELECT net.http_post(
    url := 'https://bjjjxfrcwaghzddcsdhj.supabase.co/functions/v1/weekly-report',
    headers := '{"Authorization": "Bearer <your-service-role-key>"}'::jsonb
  );
  $$
);
```

---

## Step 8 — Build and Deploy Frontend

### Local development

```bash
# In the project root
npm install
npm run dev
# Opens at http://localhost:3000
```

### Deploy to Vercel

**Option A — Via Vercel CLI:**

```bash
npm install -g vercel
vercel login
vercel --prod
```

**Option B — Via GitHub:**

1. Push the project to GitHub:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/real-estate-crm.git
git push -u origin main
```

2. Go to https://vercel.com → New Project → Import from GitHub
3. Select your repository
4. Add Environment Variables in Vercel:
   - `VITE_SUPABASE_URL` = `https://bjjjxfrcwaghzddcsdhj.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `sb_publishable_WLw5ZwtKzgIPmPrQnZ5tRQ_9mpqpF1l`
5. Click **Deploy**

---

## Step 9 — Post-deployment: Enter API Keys in Settings

1. Log in as Admin
2. Go to **Settings → API Keys & Integrations**
3. Enter your Anthropic, WhatsApp, and Meta API keys
4. Click **Save Settings**

The keys are stored in the `settings` table in Supabase (server-side only).

---

## Environment Variables Reference

| Variable | Where | Description |
|---|---|---|
| `VITE_SUPABASE_URL` | Vercel + .env | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Vercel + .env | Supabase anon/public key |
| `ANTHROPIC_API_KEY` | Supabase secrets | Claude AI key (server-side only) |
| `WHATSAPP_API_TOKEN` | Supabase secrets | WhatsApp Business API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Supabase secrets | WhatsApp Phone Number ID |
| `WHATSAPP_VERIFY_TOKEN` | Supabase secrets | Webhook verification token |
| `META_APP_SECRET` | Supabase secrets | Meta app secret for signature verification |

---

## Architecture Summary

```
Browser (React + Vite + Tailwind)
   │
   ├── Supabase Auth (login, session, RLS)
   ├── Supabase Database (PostgreSQL + RLS per role)
   ├── Supabase Realtime (live WhatsApp messages)
   └── Supabase Edge Functions (Deno)
         ├── ai-chat          → Anthropic API (AI assistant)
         ├── ai-score-leads   → Anthropic API (lead scoring)
         ├── ai-report        → Anthropic API (reports)
         ├── whatsapp-webhook → Inbound WhatsApp events
         ├── whatsapp-send    → Send WhatsApp messages
         ├── whatsapp-welcome → Send welcome messages
         ├── weekly-report    → Sunday WhatsApp summary
         ├── scraper-runner   → OLX/Aqarmap scraping
         ├── meta-webhook     → Meta Lead Ads ingest
         └── admin-create-user → Create users (admin only)
```

---

## Supabase Keys (already configured)

- **Project URL:** `https://bjjjxfrcwaghzddcsdhj.supabase.co`
- **Anon Key:** `sb_publishable_WLw5ZwtKzgIPmPrQnZ5tRQ_9mpqpF1l`
- **Service Role Key:** *(set as Supabase secret only — never in frontend)*

---

## Troubleshooting

**Login fails:** Check that the admin user's profile row has `role = 'admin'` in the profiles table.

**AI chat returns error:** Ensure `ANTHROPIC_API_KEY` is set as a Supabase secret AND/OR entered in Settings.

**WhatsApp not receiving messages:** Verify the webhook URL is registered in Meta for Developers and the verify token matches.

**Edge functions 401:** Make sure the `Authorization: Bearer <service-role-key>` header is set in pg_cron calls.
