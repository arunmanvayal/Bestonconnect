export const SETUP_SQL = `-- BusinessDesk schema — run this once in your Supabase SQL editor
-- (Dashboard → SQL Editor → New query → paste → Run)

create table if not exists customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text default '',
  email text default '',
  phone text default '',
  address text default '',
  notes text default '',
  created_at timestamptz default now()
);

create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  type text not null check (type in ('asset','liability','equity','income','expense')),
  opening_balance numeric default 0,
  created_at timestamptz default now()
);

create table if not exists journal_entries (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null default current_date,
  reference text default '',
  description text default '',
  created_at timestamptz default now()
);

create table if not exists journal_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid references journal_entries(id) on delete cascade not null,
  account_id uuid references accounts(id) not null,
  debit numeric default 0,
  credit numeric default 0
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  sku text default '',
  name text not null,
  unit text default 'pcs',
  quantity numeric default 0,
  reorder_level numeric default 0,
  unit_price numeric default 0,
  created_at timestamptz default now()
);

create table if not exists stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references products(id) on delete cascade not null,
  type text not null check (type in ('in','out','adjustment')),
  quantity numeric not null,
  note text default '',
  created_at timestamptz default now()
);

-- This app connects with the anon key and has no login yet,
-- so row level security is disabled. Enable it later when you add users.
alter table customers disable row level security;
alter table accounts disable row level security;
alter table journal_entries disable row level security;
alter table journal_lines disable row level security;
alter table products disable row level security;
alter table stock_movements disable row level security;
`;
