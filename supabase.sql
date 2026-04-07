create extension if not exists pgcrypto;

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  trader text not null,
  pair text not null,
  type text not null check (type in ('long','short')),
  entry_price numeric(18,6) not null,
  stop_loss numeric(18,6) not null,
  take_profit numeric(18,6) not null,
  exit_price numeric(18,6) not null,
  profit_loss numeric(18,6) not null,
  notes text,
  trade_date timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.trades enable row level security;

-- Allow anyone using anon key to read shared dashboard data.
create policy "Public can read trades"
on public.trades
for select
using (true);

-- Block public writes (no insert/update/delete policies for anon/authenticated).
-- Netlify functions use service role key, which bypasses RLS securely.
