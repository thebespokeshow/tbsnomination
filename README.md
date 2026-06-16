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

Set these in your Vercel project dashboard:

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Your Supabase anonymous/public key |
| `RESEND_API_KEY` | Your Resend API key |

## Database

The Supabase table `nominations` should have these columns:
- `id` (uuid, primary key, default `gen_random_uuid()`)
- `nominee_name` (text, required)
- `nominee_role` (text, nullable)
- `nominee_domain` (text, nullable)
- `nominee_whatsapp` (text, nullable)
- `nominee_linkedin` (text, nullable)
- `nomination_reason` (text, required)
- `nominator_name` (text, required)
- `nominator_email` (text, required)
- `created_at` (timestamp with time zone, default `now()`)

## Deployment

Push to GitHub → Import into Vercel → Add environment variables → Deploy.