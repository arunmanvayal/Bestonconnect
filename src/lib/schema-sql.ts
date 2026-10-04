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

-- ===== Sales returns =====
create table if not exists sales_returns (
  id uuid primary key default gen_random_uuid(),
  return_no text not null,
  return_date date not null default current_date,
  invoice_id uuid references invoices(id) on delete set null,
  bill_no text default '',
  party_id uuid references customers(id) on delete set null,
  party_name text default '',
  refund_mode text default 'credit',
  taxable numeric default 0,
  total_tax numeric default 0,
  amount numeric default 0,
  reason text default '',
  journal_entry_id uuid references journal_entries(id) on delete set null,
  created_at timestamptz default now()
);
create table if not exists sales_return_items (
  id uuid primary key default gen_random_uuid(),
  return_id uuid references sales_returns(id) on delete cascade not null,
  invoice_item_id uuid references invoice_items(id) on delete set null,
  product_id uuid references products(id) on delete set null,
  item_name text default '',
  quantity numeric default 0,
  rate numeric default 0,
  gst_rate numeric default 0,
  taxable numeric default 0,
  tax numeric default 0,
  amount numeric default 0
);
alter table sales_returns disable row level security;
alter table sales_return_items disable row level security;
`;

export const COMPANY_SQL = `
-- ===== Login + separate company accounts (safe to run again) =====
create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  logo text default '',
  tagline text default '',
  address text default '',
  state text default '',
  gstin text default '',
  phone text default '',
  email text default '',
  website text default '',
  bank_name text default '',
  account_name text default '',
  account_no text default '',
  ifsc text default '',
  upi text default '',
  terms text default '',
  signature_label text default 'Authorised Signatory',
  created_at timestamptz default now()
);
create table if not exists user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  active_company_id uuid references companies(id) on delete set null
);
revoke all on companies, user_settings from anon;
grant select, insert, update, delete on companies, user_settings to authenticated;
alter table companies enable row level security;
alter table user_settings enable row level security;
drop policy if exists "own companies" on companies;
create policy "own companies" on companies for all to authenticated
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "own settings" on user_settings;
create policy "own settings" on user_settings for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and (active_company_id is null or exists (
    select 1 from companies c where c.id = active_company_id and c.owner_id = auth.uid())));

create or replace function public.current_company() returns uuid
language sql stable security definer set search_path = public as $fn$
  select s.active_company_id from user_settings s
  join companies c on c.id = s.active_company_id and c.owner_id = auth.uid()
  where s.user_id = auth.uid()
$fn$;
grant execute on function public.current_company() to authenticated;

do $do$ declare t text; begin
  foreach t in array array['customers','accounts','journal_entries','journal_lines','products','stock_movements',
    'invoices','invoice_items','payments','sales_returns','sales_return_items'] loop
    execute format('alter table %I add column if not exists company_id uuid default public.current_company() references companies(id) on delete cascade', t);
    execute format('create index if not exists %I on %I(company_id)', t || '_company_idx', t);
    execute format('revoke all on %I from anon', t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "company scope" on %I', t);
    execute format('create policy "company scope" on %I for all to authenticated using (company_id = public.current_company()) with check (company_id = public.current_company())', t);
  end loop;
end $do$;

-- Moves records created before logins existed into the owner's first company
create or replace function public.claim_unassigned_data(_company uuid) returns void
language plpgsql security definer set search_path = public as $fn$
declare t text; begin
  if not exists (select 1 from companies where id = _company and owner_id = auth.uid()) then
    raise exception 'Not your company';
  end if;
  foreach t in array array['customers','accounts','journal_entries','journal_lines','products','stock_movements',
    'invoices','invoice_items','payments','sales_returns','sales_return_items'] loop
    execute format('update %I set company_id = $1 where company_id is null', t) using _company;
  end loop;
end $fn$;
grant execute on function public.claim_unassigned_data(uuid) to authenticated;
`;
