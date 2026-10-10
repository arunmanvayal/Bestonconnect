/** All rows in a reviewed spreadsheet commit together, including stock movements. */
export const FINANCIAL_IMPORT_SQL = `
create or replace function public.import_business_rows(_dataset text, _rows jsonb, _update boolean, _request_key uuid) returns jsonb
language plpgsql security invoker set search_path=public as $fn$
declare cid uuid:=current_company(); prior jsonb; row jsonb; r jsonb; id uuid; p products%rowtype; c customers%rowtype; a accounts%rowtype;
 inserted integer:=0; updated integer:=0; skipped integer:=0; qty numeric; result jsonb;
begin
 prior:=financial_begin(_request_key,'import',jsonb_build_object('dataset',_dataset,'rows',_rows,'update',_update)); if prior is not null then return prior; end if;
 if _dataset not in ('products','customers','vendors','ledgers') or jsonb_typeof(_rows)<>'array' then raise exception 'Invalid import'; end if;
 for row in select value from jsonb_array_elements(_rows) loop
  id:=null;
  if _dataset='products' then
   r:=row;
   select * into p from products where company_id=cid and ((nullif(r->>'barcode','') is not null and lower(barcode)=lower(r->>'barcode')) or (nullif(r->>'sku','') is not null and lower(sku)=lower(r->>'sku'))) order by id limit 1 for update;
   if found then id:=p.id; end if;
   if id is not null and not _update then skipped:=skipped+1; continue; end if;
   qty:=(r->>'quantity')::numeric; if qty is null or qty<0 then raise exception 'Invalid imported stock'; end if;
   id:=save_product_master(id,r,case when id is null then null else to_jsonb(p) end);
   if p.id is not null then
    perform post_financial_stock(id,jsonb_build_object('mode','adjustment','quantity',qty,'cost_price',r->'cost_price','unit_price',r->'unit_price','expected_quantity',p.quantity,'expected_cost',r->'cost_price','expected_price',r->'unit_price','reason','Excel stock reconciliation'),gen_random_uuid());
    updated:=updated+1;
   else inserted:=inserted+1; end if;
  elsif _dataset='ledgers' then
   a:=jsonb_populate_record(null::accounts,row);
   if nullif(trim(a.code),'') is null or nullif(trim(a.name),'') is null or a.type not in ('asset','liability','equity','income','expense') or a.opening_balance is null then raise exception 'Invalid ledger row'; end if;
   select id into id from accounts where company_id=cid and code=a.code for update;
   if id is not null then
    if not _update then skipped:=skipped+1; continue; end if;
    update accounts set name=a.name,type=a.type,opening_balance=a.opening_balance where accounts.id=id and company_id=cid; updated:=updated+1;
   else insert into accounts(company_id,code,name,type,opening_balance) values(cid,a.code,a.name,a.type,a.opening_balance); inserted:=inserted+1; end if;
  else
   c:=jsonb_populate_record(null::customers,row);
   if nullif(trim(c.name),'') is null or c.opening_balance is null then raise exception 'Invalid party row'; end if;
   select id into id from customers where company_id=cid and lower(trim(name))=lower(trim(c.name)) and party_type=case when _dataset='vendors' then 'supplier' else 'customer' end order by id limit 1 for update;
   if id is not null and not _update then skipped:=skipped+1; continue; end if;
   if id is null then
    insert into customers(company_id,name,party_type) values(cid,c.name,case when _dataset='vendors' then 'supplier' else 'customer' end) returning customers.id into id; inserted:=inserted+1;
   else updated:=updated+1; end if;
   update customers set code=c.code,name=c.name,address=c.address,contact_no=c.contact_no,phone=c.phone,area=c.area,gstin=c.gstin,email=c.email,notes=c.notes,discount=c.discount,opening_balance=c.opening_balance where customers.id=id and company_id=cid;
  end if;
 end loop;
 result:=jsonb_build_object('inserted',inserted,'updated',updated,'skipped',skipped);
 insert into financial_requests(company_id,request_key,operation,payload,result) values(cid,_request_key,'import',jsonb_build_object('dataset',_dataset,'rows',_rows,'update',_update),result);
 return result;
end $fn$;
revoke all on function public.import_business_rows(text,jsonb,boolean,uuid) from public,anon;
grant execute on function public.import_business_rows(text,jsonb,boolean,uuid) to authenticated;
notify pgrst,'reload schema';
`;
