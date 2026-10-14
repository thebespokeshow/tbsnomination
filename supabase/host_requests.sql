-- Run once in Supabase → SQL Editor (same project that holds the `nominations` table).
create table if not exists public.host_requests (
  id               uuid primary key default gen_random_uuid(),
  institution      text not null,
  city             text,
  contact_name     text not null,
  designation      text,
  email            text not null,
  phone            text,
  preferred_timing text,
  audience_size    text,
  topic_interest   text,
  message          text,
  created_at       timestamptz not null default now()
);

-- Keep RLS on. Inserts come from api/host.js using the service-role key,
-- so no public policy is needed (submissions are admin-only reads).
alter table public.host_requests enable row level security;
