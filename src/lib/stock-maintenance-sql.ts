/** Owner-run external database extension; every mutation is company scoped and atomic. */
export const STOCK_MAINTENANCE_SQL = `
create or replace function public.maintain_stock(_action text, _rows jsonb)
returns integer language plpgsql security invoker set search_path = public as $fn$
declare cid uuid := public.current_company(); r jsonb; p products%rowtype; n integer := 0; ids uuid[]; pid uuid;
begin
  if auth.uid() is null or cid is null then raise exception 'Sign in and select a company'; end if;
  if _action not in ('delete','barcodes','edit') or jsonb_typeof(_rows) <> 'array' or jsonb_array_length(_rows) = 0 then raise exception 'Invalid stock action'; end if;
  select array_agg((value->>'id')::uuid) into ids from jsonb_array_elements(_rows);
  if cardinality(ids) <> (select count(distinct x) from unnest(ids) x) then raise exception 'Duplicate product selection'; end if;
  -- Serialize company maintenance and lock all selected products before any writes.
  perform pg_advisory_xact_lock(hashtext(cid::text));
  perform 1 from products where company_id = cid and id = any(ids) order by id for update;
  if (select count(*) from products where company_id = cid and id = any(ids)) <> cardinality(ids) then raise exception 'Some products are no longer accessible'; end if;
  for r in select value from jsonb_array_elements(_rows) loop
    select * into p from products where id = (r->>'id')::uuid and company_id = cid;
    if p.quantity is distinct from (r->>'quantity')::numeric or coalesce(p.barcode,'') <> coalesce(r->>'old_barcode','') or coalesce(p.sku,'') <> coalesce(r->>'old_sku','') or p.name <> r->>'old_name' then raise exception 'Stock changed. Refresh and review again'; end if;
    if _action = 'delete' then
      if p.quantity <> 0 then raise exception 'Only zero-stock products can be deleted'; end if;
      if exists(select 1 from invoice_items where product_id = p.id)
        or exists(select 1 from sales_return_items where product_id = p.id)
        or exists(select 1 from stock_movements where product_id = p.id)
        or exists(select 1 from online_order_items where product_id = p.id)
        or exists(select 1 from online_products where product_id = p.id and enabled) then
        raise exception 'A selected product has business history or is listed online. Keep it and edit its code instead';
      end if;
    elsif _action = 'edit' then
      if jsonb_array_length(_rows) <> 1 or nullif(trim(r->>'name'),'') is null or length(r->>'name') > 300 or length(r->>'sku') > 100 or length(r->>'barcode') > 100 or nullif(trim(r->>'unit'),'') is null then raise exception 'Invalid product details'; end if;
    end if;
  end loop;
  if _action = 'barcodes' then
    if (select count(*) from products where company_id = cid) <> cardinality(ids) then raise exception 'Stock list changed. Refresh the full barcode preview'; end if;
    if exists(select 1 from jsonb_array_elements(_rows) where value->>'barcode' !~ '^[1-9][0-9]*$')
      or (select count(distinct value->>'barcode') from jsonb_array_elements(_rows)) <> cardinality(ids)
      or (select min((value->>'barcode')::bigint) from jsonb_array_elements(_rows)) <> 1
      or (select max((value->>'barcode')::bigint) from jsonb_array_elements(_rows)) <> cardinality(ids) then raise exception 'Barcode series must be 1 to product count'; end if;
    -- Temporary unique codes avoid conflicts with an existing unique barcode constraint.
    update products set barcode = 'TMP-' || gen_random_uuid()::text where company_id = cid and id = any(ids);
  end if;
  for r in select value from jsonb_array_elements(_rows) loop
    pid := (r->>'id')::uuid;
    if _action = 'delete' then delete from products where id = pid and company_id = cid;
    elsif _action = 'barcodes' then update products set barcode = r->>'barcode' where id = pid and company_id = cid;
    else update products set name = trim(r->>'name'), sku = trim(r->>'sku'), barcode = trim(r->>'barcode'), unit = trim(r->>'unit') where id = pid and company_id = cid;
    end if;
    n := n + 1;
  end loop;
  return n;
end $fn$;
revoke all on function public.maintain_stock(text,jsonb) from public, anon;
grant execute on function public.maintain_stock(text,jsonb) to authenticated;
notify pgrst, 'reload schema';
`;