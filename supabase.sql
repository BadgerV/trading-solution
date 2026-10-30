create extension if not exists pgcrypto;

create table if not exists public.traders (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  display_name text not null,
  role text not null default 'trader' check (role in ('admin', 'trader')),
  active boolean not null default true,
  password_hash text not null,
  password_salt text not null,
  must_change_password boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trades (
  id uuid primary key default gen_random_uuid(),
  trader_id uuid references public.traders(id) on delete set null,
  trader text not null,
  pair text not null,
  type text not null check (type in ('buy','sell')),
  lot_size numeric(18,2) not null default 0.01,
  entry_price numeric(18,6) not null,
  stop_loss numeric(18,6) not null,
  take_profit numeric(18,6) not null,
  exit_price numeric(18,6) not null,
  profit_loss numeric(18,6) not null,
  notes text,
  trade_date timestamptz not null,
  created_at timestamptz not null default now()
);

create table if not exists public.instrument_specs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  symbol_pattern text not null,
  match_type text not null default 'exact' check (match_type in ('exact', 'prefix', 'regex')),
  pricing_model text not null default 'contract' check (pricing_model in ('forex', 'contract')),
  contract_size numeric(18,4) not null,
  priority integer not null default 100,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.trades add column if not exists trader_id uuid references public.traders(id) on delete set null;
alter table public.trades add column if not exists lot_size numeric(18,2) not null default 0.01;
alter table public.instrument_specs add column if not exists label text;
alter table public.instrument_specs add column if not exists symbol_pattern text;
alter table public.instrument_specs add column if not exists match_type text not null default 'exact';
alter table public.instrument_specs add column if not exists pricing_model text not null default 'contract';
alter table public.instrument_specs add column if not exists contract_size numeric(18,4);
alter table public.instrument_specs add column if not exists priority integer not null default 100;
alter table public.instrument_specs add column if not exists active boolean not null default true;
alter table public.instrument_specs add column if not exists notes text;
alter table public.instrument_specs add column if not exists created_at timestamptz not null default now();
alter table public.instrument_specs add column if not exists updated_at timestamptz not null default now();
alter table public.traders add column if not exists role text not null default 'trader';
alter table public.traders add column if not exists active boolean not null default true;
alter table public.traders add column if not exists must_change_password boolean not null default true;
alter table public.traders add column if not exists last_login_at timestamptz;
alter table public.traders add column if not exists updated_at timestamptz not null default now();

alter table public.trades drop constraint if exists trades_type_check;
alter table public.trades add constraint trades_type_check check (type in ('buy','sell'));
alter table public.instrument_specs drop constraint if exists instrument_specs_match_type_check;
alter table public.instrument_specs add constraint instrument_specs_match_type_check check (match_type in ('exact', 'prefix', 'regex'));
alter table public.instrument_specs drop constraint if exists instrument_specs_pricing_model_check;
alter table public.instrument_specs add constraint instrument_specs_pricing_model_check check (pricing_model in ('forex', 'contract'));

update public.trades
set type = case
  when lower(type) = 'long' then 'buy'
  when lower(type) = 'short' then 'sell'
  else lower(type)
end;

create index if not exists trades_trader_id_idx on public.trades (trader_id);
create index if not exists trades_trade_date_idx on public.trades (trade_date desc);
create index if not exists instrument_specs_priority_idx on public.instrument_specs (priority asc, active desc);

alter table public.trades enable row level security;
alter table public.traders enable row level security;
alter table public.instrument_specs enable row level security;

-- Allow anyone using anon key to read shared dashboard data.
drop policy if exists "Public can read trades" on public.trades;
create policy "Public can read trades"
on public.trades
for select
using (true);

drop policy if exists "Public can read instrument specs" on public.instrument_specs;
create policy "Public can read instrument specs"
on public.instrument_specs
for select
using (true);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists traders_set_updated_at on public.traders;
create trigger traders_set_updated_at
before update on public.traders
for each row execute function public.touch_updated_at();

drop trigger if exists instrument_specs_set_updated_at on public.instrument_specs;
create trigger instrument_specs_set_updated_at
before update on public.instrument_specs
for each row execute function public.touch_updated_at();

update public.trades t
set trader_id = tr.id
from public.traders tr
where t.trader_id is null
  and lower(t.trader) = lower(tr.display_name);

-- Block public writes (no insert/update/delete policies for anon/authenticated).
-- Netlify functions use service role key, which bypasses RLS securely.
