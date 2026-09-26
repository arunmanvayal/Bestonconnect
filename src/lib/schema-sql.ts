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

export const INVOICE_SQL = `
-- ===== Sales & Purchase invoices (safe to run again) =====
alter table customers add column if not exists party_type text default 'customer';
alter table customers add column if not exists gstin text default '';
alter table products add column if not exists barcode text default '';
alter table products add column if not exists gst_rate numeric default 18;
alter table products add column if not exists cost_price numeric default 0;

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('sale','purchase')),
  bill_no text not null,
  bill_date date not null default current_date,
  party_id uuid references customers(id) on delete set null,
  party_name text default '',
  contact text default '',
  payment_mode text default 'cash',
  tax_type text default 'gst',
  bill_type text default 'B2C',
  salesman text default '',
  ref_no text default '',
  gross numeric default 0,
  discount numeric default 0,
  taxable numeric default 0,
  cgst numeric default 0,
  sgst numeric default 0,
  igst numeric default 0,
  total_tax numeric default 0,
  other_exp numeric default 0,
  freight numeric default 0,
  cash_disc numeric default 0,
  round_off numeric default 0,
  net_total numeric default 0,
  remarks text default '',
  shipping_address text default '',
  billing_address text default '',
  journal_entry_id uuid references journal_entries(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid references invoices(id) on delete cascade not null,
  product_id uuid references products(id) on delete set null,
  item_name text default '',
  unit text default '',
  quantity numeric default 0,
  free_qty numeric default 0,
  rate numeric default 0,
  discount numeric default 0,
  gst_rate numeric default 0,
  taxable numeric default 0,
  tax numeric default 0,
  amount numeric default 0
);

alter table invoices disable row level security;
alter table invoice_items disable row level security;

-- ===== Receipts & Payments =====
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('receipt','payment')),
  voucher_no text default '',
  pay_date date not null default current_date,
  party_id uuid references customers(id) on delete set null,
  party_name text default '',
  amount numeric not null default 0,
  mode text default 'cash',
  reference text default '',
  notes text default '',
  journal_entry_id uuid references journal_entries(id) on delete set null,
  created_at timestamptz default now()
);
alter table payments disable row level security;
`;
