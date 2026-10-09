/** Owner-run extension for the existing external database. */
export const MASTERS_SQL = `
create table if not exists public.master_records (
 id uuid primary key default gen_random_uuid(),
 company_id uuid not null default public.current_company() references public.companies(id) on delete cascade,
 kind text not null check (kind in ('category','manufacturer','product_group','account_group','area','employee','cost_centre','store_location','agent')),
 name text not null check (length(trim(name)) between 1 and 200), code text not null default '',
 details jsonb not null default '{}', active boolean not null default true,
 created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.master_records to authenticated;
grant all on public.master_records to service_role;
revoke all on public.master_records from anon;
alter table public.master_records enable row level security;
drop policy if exists "company masters" on public.master_records;
create policy "company masters" on public.master_records for all to authenticated
 using (company_id = public.current_company()) with check (company_id = public.current_company());
create unique index if not exists masters_company_kind_name on public.master_records(company_id,kind,lower(trim(name)));
alter table products add column if not exists product_group text not null default 'GENERAL';
alter table products add column if not exists cgst_rate numeric;
alter table products add column if not exists sgst_rate numeric;
alter table products add column if not exists igst_rate numeric;
alter table products add column if not exists remarks text not null default '';
alter table products add column if not exists store_location text not null default 'MAIN';
alter table products add column if not exists deactivated boolean not null default false;
alter table accounts add column if not exists account_group text not null default '';

-- Populate references from existing visible company data; never duplicate stock or parties.
insert into master_records(company_id,kind,name)
select distinct p.company_id, v.kind, trim(v.name) from products p
cross join lateral (values ('category',p.category),('manufacturer',p.manufacturer),('product_group',p.product_group),('store_location',p.store_location)) v(kind,name)
where p.company_id is not null and nullif(trim(v.name),'') is not null and upper(trim(v.name)) <> 'NONE'
on conflict do nothing;
insert into master_records(company_id,kind,name)
select distinct company_id,'area',trim(area) from customers where company_id is not null and nullif(trim(area),'') is not null and upper(trim(area)) <> 'NONE'
on conflict do nothing;

-- Register every reference from product edits, invoice-created stock and Excel imports.
create or replace function public.link_master_details() returns trigger
language plpgsql security invoker set search_path = public as $fn$
declare keys text[]; k text; v text; j jsonb := to_jsonb(new);
begin
 if tg_table_name = 'products' then
  keys := array['category','manufacturer','product_group','store_location'];
  if tg_op = 'INSERT' then
   new.cgst_rate := coalesce(new.cgst_rate,coalesce(new.gst_rate,18)/2);
   new.sgst_rate := coalesce(new.sgst_rate,coalesce(new.gst_rate,18)/2);
   new.igst_rate := coalesce(new.igst_rate,new.gst_rate,18);
  elsif new.gst_rate is distinct from old.gst_rate and new.cgst_rate is not distinct from old.cgst_rate and new.sgst_rate is not distinct from old.sgst_rate then
   new.cgst_rate := new.gst_rate/2; new.sgst_rate := new.gst_rate/2; new.igst_rate := new.gst_rate;
  end if;
 elsif tg_table_name = 'customers' then keys := array['area'];
 else keys := array['account_group']; end if;
 foreach k in array keys loop
  v := trim(coalesce(j->>k,''));
  if v <> '' and upper(v) <> 'NONE' then
   insert into master_records(company_id,kind,name) values(new.company_id,k,v) on conflict do nothing;
  end if;
 end loop;
 return new;
end $fn$;
drop trigger if exists link_product_masters on products;
create trigger link_product_masters before insert or update on products for each row execute function link_master_details();
drop trigger if exists link_party_masters on customers;
create trigger link_party_masters before insert or update on customers for each row execute function link_master_details();
drop trigger if exists link_account_masters on accounts;
create trigger link_account_masters before insert or update on accounts for each row execute function link_master_details();

-- Renaming a reference updates live master links, never historical invoice snapshots.
create or replace function public.rename_master_links() returns trigger
language plpgsql security invoker set search_path = public as $fn$
begin
 if new.company_id is distinct from old.company_id or new.kind is distinct from old.kind then raise exception 'Master kind and company cannot be changed'; end if;
 if new.name is distinct from old.name then
  if new.kind in ('category','manufacturer','product_group','store_location') then
   execute format('update products set %I = $1 where company_id = $2 and lower(trim(%I)) = lower(trim($3))',new.kind,new.kind) using new.name,new.company_id,old.name;
  elsif new.kind = 'area' then update customers set area = new.name where company_id = new.company_id and lower(trim(area)) = lower(trim(old.name));
  elsif new.kind = 'account_group' then update accounts set account_group = new.name where company_id = new.company_id and lower(trim(account_group)) = lower(trim(old.name));
  end if;
 end if;
 return new;
end $fn$;
drop trigger if exists rename_master_links on master_records;
create trigger rename_master_links after update on master_records for each row execute function rename_master_links();

create or replace function public.save_product_master(_id uuid, _data jsonb, _old jsonb default null) returns uuid
language plpgsql security invoker set search_path = public as $fn$
declare cid uuid := current_company(); p products%rowtype; prior products%rowtype; pid uuid;
begin
 if auth.uid() is null or cid is null then raise exception 'Sign in and select a company'; end if;
 perform pg_advisory_xact_lock(hashtext(cid::text));
 p := jsonb_populate_record(null::products,_data);
 if nullif(trim(p.name),'') is null or nullif(trim(p.unit),'') is null or p.conv_factor is null or p.conv_factor <= 0
  or p.cost_price is null or p.unit_price is null or p.mrp is null or p.reorder_level is null or p.cgst_rate is null or p.sgst_rate is null or p.igst_rate is null
  or least(p.cost_price,p.unit_price,p.mrp,p.reorder_level,p.cgst_rate,p.sgst_rate,p.igst_rate) < 0
  or p.cgst_rate > 100 or p.sgst_rate > 100 or p.igst_rate > 100 then raise exception 'Invalid product details'; end if;
 if exists(select 1 from products where company_id = cid and (_id is null or id <> _id) and
  ((nullif(trim(p.sku),'') is not null and lower(trim(sku)) = lower(trim(p.sku))) or
   (nullif(trim(p.barcode),'') is not null and lower(trim(barcode)) = lower(trim(p.barcode))))) then raise exception 'Item code or barcode already exists'; end if;
 if _id is null then
  if coalesce(p.quantity,0) < 0 then raise exception 'Opening stock cannot be negative'; end if;
  insert into products(company_id,name,sku,barcode,unit,quantity,reorder_level,cost_price,unit_price,mrp,hsn,category,manufacturer,product_group,cgst_rate,sgst_rate,igst_rate,gst_rate,alt_unit,conv_factor,sale_tax_incl,purchase_tax_incl,remarks,store_location,deactivated)
  values(cid,trim(p.name),trim(p.sku),trim(p.barcode),p.unit,coalesce(p.quantity,0),p.reorder_level,p.cost_price,p.unit_price,p.mrp,p.hsn,p.category,p.manufacturer,p.product_group,p.cgst_rate,p.sgst_rate,p.igst_rate,p.cgst_rate+p.sgst_rate,p.alt_unit,p.conv_factor,p.sale_tax_incl,p.purchase_tax_incl,p.remarks,p.store_location,p.deactivated) returning id into pid;
  if p.quantity > 0 then insert into stock_movements(company_id,product_id,type,quantity,note) values(cid,pid,'in',p.quantity,'Opening stock (product master)'); end if;
 else
  select * into prior from products where id = _id and company_id = cid for update;
  if not found then raise exception 'Product is not accessible'; end if;
  if _old is null or not (to_jsonb(prior) @> _old) then raise exception 'Product changed. Refresh and review again'; end if;
  update products set name=trim(p.name),sku=trim(p.sku),barcode=trim(p.barcode),unit=p.unit,reorder_level=p.reorder_level,cost_price=p.cost_price,unit_price=p.unit_price,mrp=p.mrp,hsn=p.hsn,category=p.category,manufacturer=p.manufacturer,product_group=p.product_group,cgst_rate=p.cgst_rate,sgst_rate=p.sgst_rate,igst_rate=p.igst_rate,gst_rate=p.cgst_rate+p.sgst_rate,alt_unit=p.alt_unit,conv_factor=p.conv_factor,sale_tax_incl=p.sale_tax_incl,purchase_tax_incl=p.purchase_tax_incl,remarks=p.remarks,store_location=p.store_location,deactivated=p.deactivated where id=_id and company_id=cid;
  pid := _id;
 end if;
 return pid;
end $fn$;
revoke all on function public.save_product_master(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.save_product_master(uuid,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
`;
