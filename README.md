# The Bespoke Show — Nomination Form

A nomination portal for Season 02 of **The Bespoke Show**, deployed on **Vercel** with **Supabase** (database) and **Resend** (email notifications).

## Tech Stack

- **Frontend:** Vanilla HTML + CSS + JavaScript (no framework)
- **Backend:** Vercel Serverless Functions (Node.js 18.x)
- **Database:** Supabase (PostgreSQL)
- **Email:** Resend

## Local Development

```bash
# Install dependencies
npm install

# Run Vercel dev server (requires Vercel CLI)
npm run dev
```

## Environment Variables

Set these in your **Vercel project dashboard** → Settings → Environment Variables:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL (e.g. `https://xxxx.supabase.co`) |
| `SUPABASE_SERVICE_KEY` | Your Supabase **service-role** key (NOT the anon key) — found in Supabase → Project Settings → API → `service_role` secret |
| `RESEND_API_KEY` | Your Resend API key |

> **Why the service-role key?**
> Supabase enables Row Level Security (RLS) on all tables by default, which blocks inserts
> from the anonymous key unless you add an explicit policy. The service-role key bypasses
> RLS entirely and is safe to use here because it lives only in Vercel's server-side
> environment — it is never sent to the browser.

## Database Setup

Run the following SQL in **Supabase → SQL Editor** to create the table:

```sql
-- Create the nominations table
create table if not exists public.nominations (
  id                uuid primary key default gen_random_uuid(),
  nominee_name      text not null,
  nominee_role      text,
  nominee_domain    text,
  nominee_whatsapp  text,
  nominee_linkedin  text,
  nomination_reason text not null,
  nominator_name    text not null,
  nominator_email   text not null,
  created_at        timestamptz not null default now()
);

-- Enable Row Level Security (Supabase default — keep it on)
alter table public.nominations enable row level security;

-- No public SELECT policy needed (submissions are admin-only reads)
-- Inserts are handled server-side with the service-role key, so no
-- additional RLS policy is required.
```

## Deployment

1. Push to GitHub
2. Import the repo into [Vercel](https://vercel.com)
3. Add the three environment variables above in Vercel → Settings → Environment Variables
4. Deploy — Vercel auto-detects the `api/` folder as serverless functions

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Nominations not saving | Wrong Supabase key (anon instead of service-role) | Set `SUPABASE_SERVICE_KEY` to the `service_role` secret from Supabase |
| 500 error on submit | Missing env variables in Vercel | Double-check all three env vars are set and re-deployed |
| Form submits but no email | Wrong / missing `RESEND_API_KEY` | Check Resend dashboard for the correct key |
