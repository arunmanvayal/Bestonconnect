export const ONLINE_SHOP_SQL = `
-- ===== Online shop: safe to run again after the company setup =====
create table if not exists public.online_products (
  product_id uuid primary key references public.products(id) on delete cascade,
  company_id uuid not null default public.current_company() references public.companies(id) on delete cascade,
  enabled boolean not null default false,
  category text not null default 'Electricals' check (category in ('Electricals','Electronics','Hardware')),
  description text not null default '' check (length(description) <= 2000),
  image_url text not null default '',
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.online_products to authenticated;
grant all on public.online_products to service_role;
revoke all on public.online_products from anon;
alter table public.online_products enable row level security;
drop policy if exists "owner online products" on public.online_products;
create policy "owner online products" on public.online_products for all to authenticated
using (company_id = public.current_company()) with check (
  company_id = public.current_company() and exists (
    select 1 from public.products p where p.id = product_id and p.company_id = public.current_company()
  )
);

create table if not exists public.online_orders (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  order_no text not null unique,
  customer_name text not null, phone text not null, address text not null, notes text not null default '',
  status text not null default 'new' check (status in ('new','confirmed','ready','completed','cancelled')),
  total numeric not null check (total >= 0),
  request_key uuid not null unique,
  created_at timestamptz not null default now()
);
grant select on public.online_orders to authenticated;
grant all on public.online_orders to service_role;
revoke all on public.online_orders from anon;
alter table public.online_orders enable row level security;
drop policy if exists "owner online orders" on public.online_orders;
create policy "owner online orders" on public.online_orders for select to authenticated using (company_id = public.current_company());

create table if not exists public.online_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.online_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete restrict,
  item_name text not null, quantity integer not null check (quantity > 0),
  price numeric not null check (price >= 0), amount numeric not null check (amount >= 0)
);
grant select on public.online_order_items to authenticated;
grant all on public.online_order_items to service_role;
revoke all on public.online_order_items from anon;
alter table public.online_order_items enable row level security;
drop policy if exists "owner online order items" on public.online_order_items;
create policy "owner online order items" on public.online_order_items for select to authenticated using (
  exists (select 1 from public.online_orders o where o.id = order_id and o.company_id = public.current_company())
);

-- Only explicit, customer-safe fields are public; stock tables remain private.
create or replace function public.online_catalog() returns jsonb
language sql stable security definer set search_path = public as $fn$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'company_id', p.company_id, 'name', p.name, 'sku', p.sku, 'unit', p.unit,
    'price', round(p.unit_price * case when p.sale_tax_incl then 1 else 1 + coalesce(p.gst_rate,0)/100 end, 2),
    'mrp', p.mrp, 'quantity', greatest(p.quantity,0), 'category', op.category,
    'description', op.description, 'image_url', op.image_url, 'company_name', c.name
  ) order by p.name), '[]'::jsonb)
  from public.online_products op join public.products p on p.id = op.product_id and p.company_id = op.company_id
  join public.companies c on c.id = p.company_id
  where op.enabled;
$fn$;
revoke all on function public.online_catalog() from public;
grant execute on function public.online_catalog() to anon, authenticated;

-- Guest order intake; totals, visibility, quantities and company are validated here.
create or replace function public.place_online_order(_company uuid, _customer jsonb, _items jsonb, _request_key uuid) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare oid uuid; ono text; p record; item jsonb; qty integer; price numeric; order_total numeric := 0; old_order record;
begin
  if _request_key is null then raise exception 'Missing request key'; end if;
  perform pg_advisory_xact_lock(hashtext(_request_key::text));
  select * into old_order from online_orders where request_key = _request_key;
  if found then return jsonb_build_object('order_no', old_order.order_no, 'total', old_order.total); end if;
  if jsonb_typeof(_customer) is distinct from 'object' or jsonb_typeof(_items) is distinct from 'array' then raise exception 'Invalid order'; end if;
  if length(trim(coalesce(_customer->>'name',''))) not between 2 and 100
    or coalesce(_customer->>'phone','') !~ '^[+0-9 ()-]{7,20}$'
    or length(trim(coalesce(_customer->>'address',''))) not between 5 and 1000
    or length(coalesce(_customer->>'notes','')) > 1000 then raise exception 'Invalid contact details'; end if;
  if jsonb_array_length(_items) not between 1 and 100 then raise exception 'Invalid basket'; end if;
  if (select count(distinct value->>'product_id') from jsonb_array_elements(_items)) <> jsonb_array_length(_items) then raise exception 'Duplicate products'; end if;
  oid := gen_random_uuid(); ono := 'ON-' || upper(replace(oid::text,'-',''));
  insert into online_orders(id,company_id,order_no,customer_name,phone,address,notes,total,request_key)
    values(oid,_company,ono,trim(_customer->>'name'),trim(_customer->>'phone'),trim(_customer->>'address'),coalesce(_customer->>'notes',''),0,_request_key);
  for item in select value from jsonb_array_elements(_items) order by value->>'product_id' loop
    if coalesce(item->>'quantity','') !~ '^[0-9]{1,6}$' then raise exception 'Invalid quantity'; end if;
    qty := (item->>'quantity')::integer;
    select pr.* into p from products pr join online_products op on op.product_id = pr.id and op.company_id = pr.company_id
      where pr.id = (item->>'product_id')::uuid and pr.company_id = _company and op.enabled for update of pr;
    if not found or qty < 1 or qty > p.quantity then raise exception 'An item is unavailable or has insufficient stock'; end if;
    price := round(p.unit_price * case when p.sale_tax_incl then 1 else 1 + coalesce(p.gst_rate,0)/100 end,2);
    if price < 0 then raise exception 'Invalid product price'; end if;
    insert into online_order_items(order_id,product_id,item_name,quantity,price,amount) values(oid,p.id,p.name,qty,price,round(price*qty,2));
    order_total := order_total + round(price*qty,2);
  end loop;
  update online_orders set total = order_total where id = oid;
  return jsonb_build_object('order_no',ono,'total',order_total);
end $fn$;
revoke all on function public.place_online_order(uuid,jsonb,jsonb,uuid) from public;
grant execute on function public.place_online_order(uuid,jsonb,jsonb,uuid) to anon, authenticated;

-- Owner processing: reserve stock on confirmation, restore it on cancellation.
create or replace function public.process_online_order(_id uuid, _status text) returns void
language plpgsql security definer set search_path = public as $fn$
declare o record; i record; available numeric;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  select * into o from online_orders where id = _id and company_id = public.current_company() for update;
  if not found then raise exception 'Order not found'; end if;
  if not ((o.status = 'new' and _status in ('confirmed','cancelled'))
    or (o.status = 'confirmed' and _status in ('ready','cancelled'))
    or (o.status = 'ready' and _status in ('completed','cancelled'))) then raise exception 'Invalid order status change'; end if;
  for i in select * from online_order_items where order_id = _id order by product_id loop
    select quantity into available from products where id = i.product_id and company_id = o.company_id for update;
    if not found then raise exception 'Product not found'; end if;
    if _status = 'confirmed' then
      if available < i.quantity then raise exception 'Insufficient stock for %', i.item_name; end if;
      update products set quantity = quantity - i.quantity where id = i.product_id and company_id = o.company_id;
      insert into stock_movements(company_id,product_id,type,quantity,note) values(o.company_id,i.product_id,'out',i.quantity,'Online order ' || o.order_no);
    elsif _status = 'cancelled' and o.status in ('confirmed','ready') then
      update products set quantity = quantity + i.quantity where id = i.product_id and company_id = o.company_id;
      insert into stock_movements(company_id,product_id,type,quantity,note) values(o.company_id,i.product_id,'in',i.quantity,'Cancelled online order ' || o.order_no);
    end if;
  end loop;
  update online_orders set status = _status where id = _id;
end $fn$;
revoke all on function public.process_online_order(uuid,text) from public;
grant execute on function public.process_online_order(uuid,text) to authenticated;

-- Create a public bucket named online-products via Storage before photo uploads.
-- Storage object permissions do not expose any private business tables.
drop policy if exists "online photo owner read" on storage.objects;
create policy "online photo owner read" on storage.objects for select to authenticated using (
  bucket_id = 'online-products' and (storage.foldername(name))[1] = public.current_company()::text
);
drop policy if exists "online photo owner insert" on storage.objects;
create policy "online photo owner insert" on storage.objects for insert to authenticated with check (
  bucket_id = 'online-products' and (storage.foldername(name))[1] = public.current_company()::text
);
drop policy if exists "online photo owner delete" on storage.objects;
create policy "online photo owner delete" on storage.objects for delete to authenticated using (
  bucket_id = 'online-products' and (storage.foldername(name))[1] = public.current_company()::text
);
`;