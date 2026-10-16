/** Setup 13: set-based maintain_stock so thousands of products finish within statement timeouts. */
export const STOCK_BARCODE_FAST_SQL = `
create or replace function public.maintain_stock(_action text, _rows jsonb)
returns integer language plpgsql security invoker set search_path = public as $fn$
declare cid uuid := public.current_company(); ids uuid[]; total integer; r jsonb;
begin
  if auth.uid() is null or cid is null then raise exception 'Sign in and select a company'; end if;
  if _action not in ('delete','barcodes','edit') or jsonb_typeof(_rows) <> 'array' or jsonb_array_length(_rows) = 0 then raise exception 'Invalid stock action'; end if;
  create temp table if not exists _stock_rows (id uuid primary key, quantity numeric, old_barcode text, old_sku text, old_name text, barcode text, sku text, name text, unit text) on commit drop;
  truncate _stock_rows;
  begin
    insert into _stock_rows select * from jsonb_to_recordset(_rows) as x(id uuid, quantity numeric, old_barcode text, old_sku text, old_name text, barcode text, sku text, name text, unit text);
  exception when unique_violation then raise exception 'Duplicate product selection';
  end;
  total := (select count(*) from _stock_rows);
  select array_agg(id) into ids from _stock_rows;
  perform pg_advisory_xact_lock(hashtext(cid::text));
  perform 1 from products where company_id = cid and id = any(ids) order by id for update;
  if (select count(*) from products where company_id = cid and id = any(ids)) <> total then raise exception 'Some products are no longer accessible'; end if;
  if exists(select 1 from _stock_rows s join products p on p.id = s.id
    where p.quantity is distinct from s.quantity or coalesce(p.barcode,'') <> coalesce(s.old_barcode,'') or coalesce(p.sku,'') <> coalesce(s.old_sku,'') or p.name <> s.old_name) then
    raise exception 'Stock changed. Refresh and review again';
  end if;
  if _action = 'delete' then
    if exists(select 1 from products where id = any(ids) and quantity <> 0) then raise exception 'Only zero-stock products can be deleted'; end if;
    if exists(select 1 from invoice_items where product_id = any(ids)) or exists(select 1 from sales_return_items where product_id = any(ids))
      or exists(select 1 from stock_movements where product_id = any(ids)) or exists(select 1 from online_order_items where product_id = any(ids))
      or exists(select 1 from online_products where product_id = any(ids) and enabled) then
      raise exception 'A selected product has business history or is listed online. Keep it and edit its code instead';
    end if;
    delete from products where company_id = cid and id = any(ids);
  elsif _action = 'edit' then
    r := _rows->0;
    if total <> 1 or nullif(trim(r->>'name'),'') is null or length(r->>'name') > 300 or length(r->>'sku') > 100 or length(r->>'barcode') > 100 or nullif(trim(r->>'unit'),'') is null then raise exception 'Invalid product details'; end if;
    update products p set name = trim(s.name), sku = trim(s.sku), barcode = trim(s.barcode), unit = trim(s.unit) from _stock_rows s where p.id = s.id and p.company_id = cid;
  else
    if (select count(*) from products where company_id = cid) <> total then raise exception 'Stock list changed. Refresh the full barcode preview'; end if;
    if exists(select 1 from _stock_rows where coalesce(barcode,'') !~ '^[1-9][0-9]*$')
      or (select count(distinct barcode) from _stock_rows) <> total
      or (select min(barcode::bigint) from _stock_rows) <> 1
      or (select max(barcode::bigint) from _stock_rows) <> total then raise exception 'Barcode series must be 1 to product count'; end if;
    update products set barcode = 'TMP-' || id::text where company_id = cid and id = any(ids);
    update products p set barcode = s.barcode from _stock_rows s where p.id = s.id and p.company_id = cid;
  end if;
  return total;
end $fn$;
revoke all on function public.maintain_stock(text,jsonb) from public, anon;
grant execute on function public.maintain_stock(text,jsonb) to authenticated;
notify pgrst, 'reload schema';
`;
