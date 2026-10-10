/** Owner-applied update for the existing external database; no client-side write fallback. */
export const FINANCIAL_TRANSACTIONS_SQL = `
create table if not exists public.financial_requests (
 company_id uuid not null default public.current_company() references public.companies(id) on delete cascade,
 request_key uuid not null, operation text not null, payload jsonb not null, result jsonb not null,
 created_at timestamptz not null default now(), primary key(company_id, request_key)
);
grant select, insert on public.financial_requests to authenticated;
grant all on public.financial_requests to service_role;
revoke all on public.financial_requests from anon;
alter table public.financial_requests enable row level security;
drop policy if exists "company financial requests" on public.financial_requests;
create policy "company financial requests" on public.financial_requests for all to authenticated
 using(company_id = public.current_company()) with check(company_id = public.current_company());

create or replace function public.financial_begin(_key uuid, _operation text, _payload jsonb) returns jsonb
language plpgsql security invoker set search_path = public as $fn$
declare cid uuid := current_company(); prior financial_requests%rowtype;
begin
 if auth.uid() is null or cid is null then raise exception 'Sign in and select a company'; end if;
 if _key is null then raise exception 'Missing save request identifier'; end if;
 perform pg_advisory_xact_lock(hashtext(cid::text));
 select * into prior from financial_requests where company_id=cid and request_key=_key;
 if found then
  if prior.operation <> _operation or prior.payload <> _payload then raise exception 'Save identifier belongs to different data'; end if;
  return prior.result;
 end if;
 return null;
end $fn$;

create or replace function public.financial_account(_code text, _name text, _type text) returns uuid
language plpgsql security invoker set search_path = public as $fn$
declare aid uuid;
begin
 if auth.uid() is null or current_company() is null then raise exception 'Sign in and select a company'; end if;
 select id into aid from accounts where company_id=current_company() and code=_code order by id limit 1;
 if aid is null then insert into accounts(company_id,code,name,type) values(current_company(),_code,_name,_type) returning id into aid; end if;
 return aid;
end $fn$;

-- The same rounded item allocation is used for new bills and edits.
create or replace function public.financial_invoice_totals(_header jsonb, _lines jsonb) returns jsonb
language plpgsql immutable as $fn$
declare l jsonb; calc jsonb := '[]'; gross numeric:=0; disc numeric:=0; base numeric:=0; taxable numeric:=0; tax numeric:=0;
 bd numeric:=coalesce((_header->>'bill_discount')::numeric,0); ratio numeric; qty numeric; price numeric; d numeric; g numeric; b numeric; t numeric; net numeric; before_round numeric;
begin
 if _header->>'tax_type' is null or _header->>'tax_type' not in ('gst','igst','none') or _header->>'payment_mode' is null or _header->>'payment_mode' not in ('cash','credit','bank','upi') then raise exception 'Invalid tax or payment mode'; end if;
 if jsonb_typeof(_lines) <> 'array' or jsonb_array_length(_lines)=0 then raise exception 'Add at least one item with quantity'; end if;
 if bd < 0 or coalesce((_header->>'other_exp')::numeric,0)<0 or coalesce((_header->>'freight')::numeric,0)<0 or coalesce((_header->>'cash_disc')::numeric,0)<0 then raise exception 'Amounts cannot be negative'; end if;
 for l in select value from jsonb_array_elements(_lines) loop
  qty:=(l->>'quantity')::numeric; price:=(l->>'rate')::numeric; d:=coalesce((l->>'discount')::numeric,0); g:=coalesce((l->>'gst_rate')::numeric,0);
  if qty is null or qty<=0 or price is null or price<0 or d<0 or d>qty*price or g<0 or g>100 or coalesce((l->>'free_qty')::numeric,0)<0 or nullif(trim(l->>'item_name'),'') is null then raise exception 'Invalid item quantity or amount'; end if;
  gross:=gross+qty*price; disc:=disc+d; base:=base+qty*price-d;
 end loop;
 if bd>base then raise exception 'Bill discount exceeds item value'; end if;
 ratio:=case when base>0 then (base-bd)/base else 1 end;
 for l in select value from jsonb_array_elements(_lines) loop
  b:=round(((l->>'quantity')::numeric*(l->>'rate')::numeric-coalesce((l->>'discount')::numeric,0))*ratio,2);
  t:=case when _header->>'tax_type'='none' then 0 else round(b*coalesce((l->>'gst_rate')::numeric,0)/100,2) end;
  taxable:=taxable+b; tax:=tax+t;
  calc:=calc || jsonb_build_array(l || jsonb_build_object('taxable',b,'tax',t,'amount',b+t));
 end loop;
 before_round:=taxable+tax+coalesce((_header->>'other_exp')::numeric,0)+coalesce((_header->>'freight')::numeric,0)-coalesce((_header->>'cash_disc')::numeric,0);
 net:=round(before_round);
 if net<0 then raise exception 'Bill amount cannot be negative'; end if;
 return jsonb_build_object('lines',calc,'gross',round(gross,2),'discount',round(disc+bd,2),'taxable',taxable,'total_tax',tax,
 'cgst',case when _header->>'tax_type'='gst' then round(tax/2,2) else 0 end,
 'sgst',case when _header->>'tax_type'='gst' then tax-round(tax/2,2) else 0 end,
 'igst',case when _header->>'tax_type'='igst' then tax else 0 end,'net_total',net,'round_off',round(net-before_round,2));
end $fn$;

create or replace function public.post_financial_invoice(_kind text, _header jsonb, _lines jsonb, _request_key uuid, _invoice_id uuid default null) returns uuid
language plpgsql security invoker set search_path = public as $fn$
declare cid uuid:=current_company(); payload jsonb:=jsonb_build_object('kind',_kind,'header',_header,'lines',_lines,'id',_invoice_id);
 prior jsonb; c jsonb; l jsonb; inv invoices%rowtype; iid uuid; pid uuid; party uuid; je uuid; pay uuid; main uuid; taxacc uuid;
 p products%rowtype; delta record; qty numeric; net numeric; tax numeric; bill text:=trim(_header->>'bill_no');
begin
 prior:=financial_begin(_request_key,'invoice',payload);
 if prior is not null then return (prior->>'id')::uuid; end if;
 if _kind not in ('sale','purchase') or _kind is null then raise exception 'Invalid invoice kind'; end if;
 if nullif(bill,'') is null then raise exception 'Enter a bill number'; end if;
 if _header->>'payment_mode'='credit' and nullif(trim(_header->>'party_name'),'') is null then raise exception 'Select a party for a credit bill'; end if;
 if exists(select 1 from invoices where company_id=cid and kind=_kind and lower(trim(bill_no))=lower(bill) and (_invoice_id is null or id<>_invoice_id)) then raise exception 'Bill number already exists'; end if;
 if _invoice_id is not null then
  select * into inv from invoices where id=_invoice_id and company_id=cid and kind=_kind for update;
  if not found then raise exception 'Bill not found in this company'; end if;
  if exists(select 1 from sales_returns where invoice_id=inv.id) then raise exception 'Bills with sales returns cannot be edited'; end if;
  if _kind<>'sale' then raise exception 'Only sales bill updates are supported'; end if;
 end if;
 c:=financial_invoice_totals(_header,_lines); net:=(c->>'net_total')::numeric; tax:=(c->>'total_tax')::numeric;
 -- Resolve every product before any stock changes; any later failure rolls everything back.
 _lines:='[]';
 for l in select value from jsonb_array_elements(c->'lines') loop
  pid:=nullif(l->>'product_id','')::uuid;
  if pid is null then
   if _kind='sale' then raise exception 'Select an existing stocked product'; end if;
   if exists(select 1 from products where company_id=cid and ((nullif(trim(l->>'barcode'),'') is not null and lower(barcode)=lower(l->>'barcode')) or (nullif(trim(l->>'sku'),'') is not null and lower(sku)=lower(l->>'sku')))) then raise exception 'Product code exists. Select the existing product'; end if;
   insert into products(company_id,name,sku,barcode,unit,quantity,cost_price,unit_price,gst_rate,mrp)
   values(cid,l->>'item_name',coalesce(l->>'sku',l->>'barcode',''),coalesce(l->>'barcode',''),coalesce(nullif(l->>'unit',''),'pcs'),0,(l->>'rate')::numeric,
    coalesce((l->>'sale_price')::numeric,(l->>'rate')::numeric*(1+coalesce((l->>'profit_pct')::numeric,0)/100)),coalesce((l->>'gst_rate')::numeric,0),coalesce((l->>'mrp')::numeric,0)) returning id into pid;
  end if;
  select * into p from products where id=pid and company_id=cid for update;
  if not found or p.deactivated then raise exception 'Product not available in this company'; end if;
  _lines:=_lines || jsonb_build_array(l || jsonb_build_object('product_id',pid));
 end loop;
 for delta in select product_id,sum(old_qty)-sum(new_qty) change from (
  select product_id,quantity+coalesce(free_qty,0) old_qty,0::numeric new_qty from invoice_items where invoice_id=_invoice_id
  union all select (value->>'product_id')::uuid,0::numeric,(value->>'quantity')::numeric+coalesce((value->>'free_qty')::numeric,0) from jsonb_array_elements(_lines)
 ) x group by product_id order by product_id loop
  select quantity into qty from products where id=delta.product_id and company_id=cid for update;
  qty:=qty+case when _kind='sale' then delta.change else -delta.change end;
  if qty<0 then raise exception 'Not enough stock for this bill'; end if;
  update products set quantity=qty where id=delta.product_id and company_id=cid;
  if delta.change<>0 then insert into stock_movements(company_id,product_id,type,quantity,note)
   values(cid,delta.product_id,case when (_kind='sale' and delta.change>0) or (_kind='purchase' and delta.change<0) then 'in' else 'out' end,abs(delta.change),case when _invoice_id is null then 'Invoice ' else 'Bill update ' end || bill); end if;
 end loop;
 if nullif(trim(_header->>'party_name'),'') is not null then
  if (select count(*) from customers where company_id=cid and party_type=case when _kind='sale' then 'customer' else 'supplier' end and lower(trim(name))=lower(trim(_header->>'party_name')))>1 then raise exception 'Duplicate party names. Resolve duplicates before saving'; end if;
  select id into party from customers where company_id=cid and party_type=case when _kind='sale' then 'customer' else 'supplier' end and lower(trim(name))=lower(trim(_header->>'party_name'));
  if party is null then insert into customers(company_id,name,phone,address,party_type) values(cid,trim(_header->>'party_name'),_header->>'contact',_header->>'billing_address',case when _kind='sale' then 'customer' else 'supplier' end) returning id into party; end if;
 end if;
 pay:=financial_account(case when _header->>'payment_mode'='credit' then case when _kind='sale' then '1100' else '2000' end when _header->>'payment_mode' in ('bank','upi') then '1010' else '1000' end,
  case when _header->>'payment_mode'='credit' then case when _kind='sale' then 'Accounts Receivable' else 'Accounts Payable' end when _header->>'payment_mode' in ('bank','upi') then 'Bank' else 'Cash' end,case when _kind='purchase' and _header->>'payment_mode'='credit' then 'liability' else 'asset' end);
 main:=financial_account(case when _kind='sale' then '4000' else '5000' end,case when _kind='sale' then 'Sales' else 'Purchases' end,case when _kind='sale' then 'income' else 'expense' end);
 taxacc:=financial_account(case when _kind='sale' then '2100' else '1200' end,case when _kind='sale' then 'GST Output' else 'GST Input' end,case when _kind='sale' then 'liability' else 'asset' end);
 je:=inv.journal_entry_id;
 if je is null then insert into journal_entries(company_id,entry_date,reference,description) values(cid,(_header->>'bill_date')::date,bill,_kind || ' invoice ' || bill) returning id into je;
 else update journal_entries set entry_date=(_header->>'bill_date')::date,reference=bill,description=_kind || ' invoice ' || bill where id=je and company_id=cid;
  if not found then raise exception 'Ledger entry not accessible'; end if;
  delete from journal_lines where entry_id=je and company_id=cid;
 end if;
 if _kind='sale' then insert into journal_lines(company_id,entry_id,account_id,debit,credit) values(cid,je,pay,net,0),(cid,je,main,0,net-tax),(cid,je,taxacc,0,tax);
 else insert into journal_lines(company_id,entry_id,account_id,debit,credit) values(cid,je,main,net-tax,0),(cid,je,taxacc,tax,0),(cid,je,pay,0,net); end if;
 iid:=_invoice_id;
 if iid is null then insert into invoices(company_id,kind,bill_no,bill_date) values(cid,_kind,bill,(_header->>'bill_date')::date) returning id into iid; end if;
 update invoices set bill_no=bill,bill_date=(_header->>'bill_date')::date,party_id=party,party_name=coalesce(_header->>'party_name',''),contact=_header->>'contact',payment_mode=_header->>'payment_mode',tax_type=_header->>'tax_type',bill_type=_header->>'bill_type',salesman=_header->>'salesman',ref_no=_header->>'ref_no',
 gross=(c->>'gross')::numeric,discount=(c->>'discount')::numeric,taxable=(c->>'taxable')::numeric,total_tax=tax,cgst=(c->>'cgst')::numeric,sgst=(c->>'sgst')::numeric,igst=(c->>'igst')::numeric,net_total=net,round_off=(c->>'round_off')::numeric,
 other_exp=coalesce((_header->>'other_exp')::numeric,0),freight=coalesce((_header->>'freight')::numeric,0),cash_disc=coalesce((_header->>'cash_disc')::numeric,0),remarks=_header->>'remarks',shipping_address=_header->>'shipping_address',billing_address=_header->>'billing_address',entry_details=coalesce(_header->'entry_details','{}'),journal_entry_id=je where id=iid and company_id=cid;
 delete from invoice_items where invoice_id=iid and company_id=cid;
 for l in select value from jsonb_array_elements(_lines) loop
  pid:=(l->>'product_id')::uuid;
  insert into invoice_items(company_id,invoice_id,product_id,item_name,unit,quantity,free_qty,rate,discount,gst_rate,taxable,tax,amount,entry_details)
  values(cid,iid,pid,l->>'item_name',l->>'unit',(l->>'quantity')::numeric,coalesce((l->>'free_qty')::numeric,0),(l->>'rate')::numeric,coalesce((l->>'discount')::numeric,0),coalesce((l->>'gst_rate')::numeric,0),(l->>'taxable')::numeric,(l->>'tax')::numeric,(l->>'amount')::numeric,
   jsonb_build_object('sku',l->>'sku','barcode',l->>'barcode','serial_no',l->>'serial_no','mrp',l->'mrp','sale_price',l->'sale_price','profit_pct',l->'profit_pct'));
  if _kind='purchase' then update products set cost_price=(l->>'rate')::numeric,unit_price=coalesce((l->>'sale_price')::numeric,unit_price),mrp=coalesce((l->>'mrp')::numeric,mrp),barcode=coalesce(nullif(l->>'barcode',''),barcode),sku=coalesce(nullif(l->>'sku',''),sku) where id=pid and company_id=cid; end if;
 end loop;
 insert into financial_requests(company_id,request_key,operation,payload,result) values(cid,_request_key,'invoice',payload,jsonb_build_object('id',iid));
 return iid;
end $fn$;

-- Keep the existing sales-update API but route it through the shared calculator/transaction.
create or replace function public.update_sales_invoice(_invoice_id uuid, _header jsonb, _lines jsonb) returns uuid
language plpgsql security invoker set search_path=public as $fn$
begin return post_financial_invoice('sale',_header,_lines,gen_random_uuid(),_invoice_id); end $fn$;

create or replace function public.post_financial_payment(_payment jsonb, _request_key uuid) returns uuid
language plpgsql security invoker set search_path=public as $fn$
declare cid uuid:=current_company(); prior jsonb; party customers%rowtype; k text:=_payment->>'kind'; amt numeric:=round((_payment->>'amount')::numeric,2); cash uuid; pa uuid; je uuid; pid uuid;
begin
 prior:=financial_begin(_request_key,'payment',_payment); if prior is not null then return (prior->>'id')::uuid; end if;
 if k is null or k not in ('receipt','payment') or amt is null or amt<=0 or _payment->>'mode' is null or _payment->>'mode' not in ('cash','bank','upi','cheque') then raise exception 'Invalid payment'; end if;
 select * into party from customers where id=(_payment->>'party_id')::uuid and company_id=cid and party_type=case when k='receipt' then 'customer' else 'supplier' end;
 if not found then raise exception 'Select a party in this company'; end if;
 if exists(select 1 from payments where company_id=cid and kind=k and voucher_no=_payment->>'voucher_no') then raise exception 'Voucher number already exists. Refresh and review'; end if;
 cash:=financial_account(case when _payment->>'mode'='cash' then '1000' else '1010' end,case when _payment->>'mode'='cash' then 'Cash' else 'Bank' end,'asset');
 pa:=financial_account(case when k='receipt' then '1100' else '2000' end,case when k='receipt' then 'Accounts Receivable' else 'Accounts Payable' end,case when k='receipt' then 'asset' else 'liability' end);
 insert into journal_entries(company_id,entry_date,reference,description) values(cid,(_payment->>'pay_date')::date,_payment->>'voucher_no',k || ' ' || party.name) returning id into je;
 if k='receipt' then insert into journal_lines(company_id,entry_id,account_id,debit,credit) values(cid,je,cash,amt,0),(cid,je,pa,0,amt);
 else insert into journal_lines(company_id,entry_id,account_id,debit,credit) values(cid,je,pa,amt,0),(cid,je,cash,0,amt); end if;
 insert into payments(company_id,kind,voucher_no,pay_date,party_id,party_name,amount,mode,reference,notes,journal_entry_id)
 values(cid,k,_payment->>'voucher_no',(_payment->>'pay_date')::date,party.id,party.name,amt,_payment->>'mode',_payment->>'reference',_payment->>'notes',je) returning id into pid;
 insert into financial_requests(company_id,request_key,operation,payload,result) values(cid,_request_key,'payment',_payment,jsonb_build_object('id',pid));
 return pid;
end $fn$;

create or replace function public.post_financial_return(_return jsonb, _request_key uuid) returns numeric
language plpgsql security invoker set search_path=public as $fn$
declare cid uuid:=current_company(); prior jsonb; inv invoices%rowtype; it invoice_items%rowtype; l jsonb; prev numeric; q numeric; subtotal numeric; ratio numeric;
 amt numeric:=0; tax numeric:=0; a numeric; t numeric; allocation numeric; preceding numeric; ret uuid; je uuid; ra uuid; ta uuid; pa uuid; free_back numeric; calc jsonb:='[]'; mode text:=_return->>'refund_mode';
begin
 prior:=financial_begin(_request_key,'return',_return); if prior is not null then return (prior->>'amount')::numeric; end if;
 select * into inv from invoices where id=(_return->>'invoice_id')::uuid and company_id=cid and kind='sale' for update;
 if not found then raise exception 'Sales bill not found in this company'; end if;
 if mode is null or mode not in ('credit','cash','bank') or (mode='credit' and inv.payment_mode<>'credit') then raise exception 'Invalid refund mode for this bill'; end if;
 if exists(select 1 from sales_returns where company_id=cid and return_no=_return->>'return_no') then raise exception 'Return number already exists. Refresh and review'; end if;
 if jsonb_array_length(_return->'lines')=0 then raise exception 'Enter return quantities'; end if;
 if (select count(*) from jsonb_array_elements(_return->'lines'))<>(select count(distinct value->>'invoice_item_id') from jsonb_array_elements(_return->'lines')) then raise exception 'Duplicate return item'; end if;
 select sum(amount) into subtotal from invoice_items where invoice_id=inv.id and company_id=cid;
 for l in select value from jsonb_array_elements(_return->'lines') loop
  select * into it from invoice_items where id=(l->>'invoice_item_id')::uuid and invoice_id=inv.id and company_id=cid for update;
  if not found then raise exception 'Return item does not belong to this bill'; end if;
  select coalesce(sum(quantity),0) into prev from sales_return_items where invoice_item_id=it.id and company_id=cid;
  q:=(l->>'qty')::numeric;
  if q is null or q<=0 or prev+q>it.quantity then raise exception 'Return quantity exceeds remaining sold quantity'; end if;
  select coalesce(sum(amount),0) into preceding from invoice_items where invoice_id=inv.id and company_id=cid and id<it.id;
  allocation:=case when subtotal>0 then round(inv.net_total*(preceding+it.amount)/subtotal,2)-round(inv.net_total*preceding/subtotal,2) else 0 end;
  -- Cumulative allocation makes partial + final returns equal the rounded bill exactly.
  a:=round(allocation*(prev+q)/it.quantity,2)-round(allocation*prev/it.quantity,2);
  t:=case when inv.tax_type='none' then 0 else round(it.tax*(prev+q)/it.quantity,2)-round(it.tax*prev/it.quantity,2) end;
  free_back:=coalesce(it.free_qty,0)*q/it.quantity;
  calc:=calc || jsonb_build_array(jsonb_build_object('id',it.id,'product_id',it.product_id,'name',it.item_name,'rate',it.rate,'gst_rate',it.gst_rate,'qty',q,'stock_qty',q+free_back,'amount',a,'tax',t));
  amt:=amt+a; tax:=tax+t;
 end loop;
 ra:=financial_account('4010','Sales Returns','income'); ta:=financial_account('2100','GST Output','liability');
 pa:=financial_account(case mode when 'credit' then '1100' when 'bank' then '1010' else '1000' end,case mode when 'credit' then 'Accounts Receivable' when 'bank' then 'Bank' else 'Cash' end,'asset');
 insert into journal_entries(company_id,entry_date,reference,description) values(cid,(_return->>'return_date')::date,_return->>'return_no','Sales return against ' || inv.bill_no) returning id into je;
 insert into journal_lines(company_id,entry_id,account_id,debit,credit) values(cid,je,ra,amt-tax,0),(cid,je,ta,tax,0),(cid,je,pa,0,amt);
 insert into sales_returns(company_id,return_no,return_date,invoice_id,bill_no,party_id,party_name,refund_mode,taxable,total_tax,amount,reason,journal_entry_id)
 values(cid,_return->>'return_no',(_return->>'return_date')::date,inv.id,inv.bill_no,inv.party_id,inv.party_name,mode,amt-tax,tax,amt,_return->>'reason',je) returning id into ret;
 for l in select value from jsonb_array_elements(calc) loop
  insert into sales_return_items(company_id,return_id,invoice_item_id,product_id,item_name,quantity,rate,gst_rate,taxable,tax,amount)
   values(cid,ret,(l->>'id')::uuid,(l->>'product_id')::uuid,l->>'name',(l->>'qty')::numeric,(l->>'rate')::numeric,(l->>'gst_rate')::numeric,(l->>'amount')::numeric-(l->>'tax')::numeric,(l->>'tax')::numeric,(l->>'amount')::numeric);
  if nullif(l->>'product_id','') is not null then
   update products set quantity=quantity+(l->>'stock_qty')::numeric where id=(l->>'product_id')::uuid and company_id=cid;
   if not found then raise exception 'Return product not available'; end if;
   insert into stock_movements(company_id,product_id,type,quantity,note) values(cid,(l->>'product_id')::uuid,'in',(l->>'stock_qty')::numeric,'Sales return ' || (_return->>'return_no'));
  end if;
 end loop;
 insert into financial_requests(company_id,request_key,operation,payload,result) values(cid,_request_key,'return',_return,jsonb_build_object('amount',amt));
 return amt;
end $fn$;

create or replace function public.post_financial_stock(_product_id uuid, _change jsonb, _request_key uuid) returns numeric
language plpgsql security invoker set search_path=public as $fn$
declare cid uuid:=current_company(); payload jsonb:=jsonb_build_object('id',_product_id,'change',_change); prior jsonb; p products%rowtype; qty numeric; diff numeric; mode text:=_change->>'mode';
begin
 prior:=financial_begin(_request_key,'stock',payload); if prior is not null then return (prior->>'quantity')::numeric; end if;
 select * into p from products where id=_product_id and company_id=cid for update;
 if not found then raise exception 'Product not found'; end if;
 if mode in ('in','out') then
  if (_change->>'quantity')::numeric is null or (_change->>'quantity')::numeric<=0 then raise exception 'Quantity must be greater than zero'; end if;
  qty:=p.quantity+(_change->>'quantity')::numeric*case when mode='in' then 1 else -1 end;
 elsif mode='adjustment' then
  if (_change->>'expected_quantity')::numeric is distinct from p.quantity or (_change->>'expected_cost')::numeric is distinct from p.cost_price or (_change->>'expected_price')::numeric is distinct from p.unit_price then raise exception 'Stock changed. Reopen and review'; end if;
  qty:=(_change->>'quantity')::numeric;
  if (_change->>'cost_price')::numeric is null or (_change->>'unit_price')::numeric is null or least((_change->>'cost_price')::numeric,(_change->>'unit_price')::numeric)<0 then raise exception 'Prices cannot be negative'; end if;
 else raise exception 'Invalid stock action'; end if;
 if qty is null or qty<0 then raise exception 'Not enough stock'; end if;
 diff:=qty-p.quantity;
 if diff<>0 then insert into stock_movements(company_id,product_id,type,quantity,note) values(cid,p.id,case when diff>0 then 'in' else 'out' end,abs(diff),coalesce(_change->>'reason','Stock change')); end if;
 update products set quantity=qty,cost_price=case when mode='adjustment' then (_change->>'cost_price')::numeric else cost_price end,unit_price=case when mode='adjustment' then (_change->>'unit_price')::numeric else unit_price end where id=p.id and company_id=cid;
 insert into financial_requests(company_id,request_key,operation,payload,result) values(cid,_request_key,'stock',payload,jsonb_build_object('quantity',qty)); return qty;
end $fn$;

create or replace function public.post_financial_journal(_entry jsonb, _lines jsonb, _request_key uuid) returns uuid
language plpgsql security invoker set search_path=public as $fn$
declare cid uuid:=current_company(); payload jsonb:=jsonb_build_object('entry',_entry,'lines',_lines); prior jsonb; je uuid; l jsonb; dr numeric:=0; cr numeric:=0; d numeric; c numeric;
begin
 prior:=financial_begin(_request_key,'journal',payload); if prior is not null then return (prior->>'id')::uuid; end if;
 for l in select value from jsonb_array_elements(_lines) loop
  d:=round(coalesce((l->>'debit')::numeric,0),2); c:=round(coalesce((l->>'credit')::numeric,0),2);
  if d<0 or c<0 or (d>0 and c>0) or not exists(select 1 from accounts where id=(l->>'account_id')::uuid and company_id=cid) then raise exception 'Invalid journal line'; end if;
  dr:=dr+d; cr:=cr+c;
 end loop;
 if dr<=0 or dr<>cr then raise exception 'Journal must have equal positive debit and credit totals'; end if;
 insert into journal_entries(company_id,entry_date,reference,description) values(cid,(_entry->>'entry_date')::date,_entry->>'reference',_entry->>'description') returning id into je;
 for l in select value from jsonb_array_elements(_lines) loop insert into journal_lines(company_id,entry_id,account_id,debit,credit) values(cid,je,(l->>'account_id')::uuid,round(coalesce((l->>'debit')::numeric,0),2),round(coalesce((l->>'credit')::numeric,0),2)); end loop;
 insert into financial_requests(company_id,request_key,operation,payload,result) values(cid,_request_key,'journal',payload,jsonb_build_object('id',je)); return je;
end $fn$;

create or replace function public.guard_linked_journal_delete() returns trigger
language plpgsql security invoker set search_path=public as $fn$
begin
 if exists(select 1 from invoices where journal_entry_id=old.id) or exists(select 1 from payments where journal_entry_id=old.id) or exists(select 1 from sales_returns where journal_entry_id=old.id) then raise exception 'Cannot delete an entry linked to a bill, payment or return'; end if;
 return old;
end $fn$;
drop trigger if exists guard_linked_journal_delete on journal_entries;
create trigger guard_linked_journal_delete before delete on journal_entries for each row execute function guard_linked_journal_delete();

do $do$ declare signature text; begin
 foreach signature in array array[
 'financial_begin(uuid,text,jsonb)','financial_account(text,text,text)','financial_invoice_totals(jsonb,jsonb)',
 'post_financial_invoice(text,jsonb,jsonb,uuid,uuid)','post_financial_payment(jsonb,uuid)','post_financial_return(jsonb,uuid)',
 'post_financial_stock(uuid,jsonb,uuid)','post_financial_journal(jsonb,jsonb,uuid)','update_sales_invoice(uuid,jsonb,jsonb)','guard_linked_journal_delete()'] loop
 execute 'revoke all on function public.' || signature || ' from public, anon';
 execute 'grant execute on function public.' || signature || ' to authenticated';
 end loop;
end $do$;
notify pgrst, 'reload schema';
`;
