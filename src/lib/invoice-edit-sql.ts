/** Run after the company setup script on the externally connected database. */
export const INVOICE_EDIT_SQL = `
-- Atomic sales bill updates: preserve bill ID and roll back every change on error.
create or replace function public.update_sales_invoice(_invoice_id uuid, _header jsonb, _lines jsonb)
returns uuid language plpgsql security invoker set search_path = public as $fn$
#variable_conflict use_variable
declare
  inv invoices%rowtype; h jsonb := _header; l jsonb; pid uuid; party uuid;
  pay uuid; main uuid; tax_account uuid; je uuid; code_value text; name_value text;
  kind_value text; qty numeric; price numeric; disc numeric; gst numeric;
  gross numeric := 0; line_discount numeric := 0; taxable numeric := 0;
  tax numeric := 0; ratio numeric; net numeric; before_round numeric;
  bd numeric; extra numeric; freight_value numeric; cash_discount numeric; delta record;
begin
  if auth.uid() is null or public.current_company() is null then raise exception 'Sign in and select a company'; end if;
  select * into inv from invoices where id = _invoice_id and kind = 'sale' for update;
  if not found then raise exception 'Sales bill not found in this company'; end if;
  if exists (select 1 from sales_returns where invoice_id = inv.id) then raise exception 'Bills with sales returns cannot be edited'; end if;
  if nullif(trim(h->>'bill_no'), '') is null then raise exception 'Enter a bill number'; end if;
  if exists (select 1 from invoices where kind = 'sale' and lower(bill_no) = lower(h->>'bill_no') and id <> inv.id) then raise exception 'Bill number already exists'; end if;
  if jsonb_array_length(_lines) = 0 then raise exception 'Add at least one item with quantity'; end if;
  bd := coalesce((h->>'bill_discount')::numeric, 0);
  extra := coalesce((h->>'other_exp')::numeric, 0);
  freight_value := coalesce((h->>'freight')::numeric, 0);
  cash_discount := coalesce((h->>'cash_disc')::numeric, 0);
  if bd < 0 or extra < 0 or freight_value < 0 or cash_discount < 0 then raise exception 'Amounts cannot be negative'; end if;
  if h->>'tax_type' not in ('gst','igst','none') or h->>'payment_mode' not in ('cash','credit','bank','upi') then raise exception 'Invalid tax or payment mode'; end if;
  for l in select value from jsonb_array_elements(_lines) loop
    qty := (l->>'quantity')::numeric; price := (l->>'rate')::numeric;
    disc := coalesce((l->>'discount')::numeric,0); gst := coalesce((l->>'gst_rate')::numeric,0);
    if qty is null or qty <= 0 or price is null or price < 0 or disc < 0 or gst < 0 or gst > 100 or coalesce((l->>'free_qty')::numeric,0) < 0 or nullif(trim(l->>'item_name'),'') is null then raise exception 'Invalid item quantity or amount'; end if;
    pid := nullif(l->>'product_id','')::uuid;
    if pid is null then
      raise exception 'Select an existing stocked product before updating this bill';
    end if;
    gross := gross + qty * price; line_discount := line_discount + disc;
    taxable := taxable + greatest(0,qty * price - disc);
    tax := tax + greatest(0,qty * price - disc) * gst / 100;
  end loop;
  ratio := case when taxable > 0 then greatest(0,taxable-bd)/taxable else 1 end;
  taxable := round(taxable * ratio,2);
  tax := case when h->>'tax_type' = 'none' then 0 else round(tax*ratio,2) end;
  before_round := taxable + tax + extra + freight_value - cash_discount;
  net := round(before_round);
  if net < 0 then raise exception 'Bill amount cannot be negative'; end if;
  -- Lock products in stable order and apply only the net quantity change.
  for delta in
    select product_id, sum(old_qty) - sum(new_qty) as quantity_change from (
      select product_id, quantity + coalesce(free_qty,0) old_qty, 0::numeric new_qty from invoice_items where invoice_id = inv.id
      union all
      select (value->>'product_id')::uuid, 0::numeric, (value->>'quantity')::numeric + coalesce((value->>'free_qty')::numeric,0) from jsonb_array_elements(_lines)
    ) changes group by product_id order by product_id
  loop
    select quantity into qty from products where id = delta.product_id for update;
    if not found then raise exception 'Product not found in this company'; end if;
    if qty + delta.quantity_change < 0 then raise exception 'Not enough stock for this bill update'; end if;
    update products set quantity = qty + delta.quantity_change where id = delta.product_id;
    if delta.quantity_change <> 0 then
      insert into stock_movements(product_id,type,quantity,note) values(delta.product_id,case when delta.quantity_change > 0 then 'in' else 'out' end,abs(delta.quantity_change),'Bill update ' || (h->>'bill_no'));
    end if;
  end loop;
  party := null;
  if nullif(trim(h->>'party_name'),'') is not null then
    select id into party from customers where lower(name) = lower(trim(h->>'party_name')) limit 1;
    if party is null then
      insert into customers(name,phone,address,party_type) values(trim(h->>'party_name'),h->>'contact',h->>'billing_address','customer') returning id into party;
    end if;
  end if;
  code_value := case when h->>'payment_mode' = 'credit' then '1100' when h->>'payment_mode' in ('bank','upi') then '1010' else '1000' end;
  name_value := case code_value when '1100' then 'Accounts Receivable' when '1010' then 'Bank' else 'Cash' end;
  select id into pay from accounts where code = code_value limit 1;
  if pay is null then insert into accounts(code,name,type) values(code_value,name_value,'asset') returning id into pay; end if;
  select id into main from accounts where code = '4000' limit 1;
  if main is null then insert into accounts(code,name,type) values('4000','Sales','income') returning id into main; end if;
  select id into tax_account from accounts where code = '2100' limit 1;
  if tax_account is null then insert into accounts(code,name,type) values('2100','GST Output','liability') returning id into tax_account; end if;
  je := inv.journal_entry_id;
  if je is not null then
    perform 1 from journal_entries where id = je for update;
    if not found then raise exception 'Ledger entry not accessible'; end if;
    update journal_entries set entry_date = (h->>'bill_date')::date, reference = h->>'bill_no', description = 'Sales invoice ' || (h->>'bill_no') || ' — ' || coalesce(h->>'party_name','') where id = je;
    delete from journal_lines where entry_id = je;
  else
    insert into journal_entries(entry_date,reference,description) values((h->>'bill_date')::date,h->>'bill_no','Sales invoice ' || (h->>'bill_no')) returning id into je;
  end if;
  insert into journal_lines(entry_id,account_id,debit,credit) values(je,pay,net,0),(je,main,0,net-tax),(je,tax_account,0,tax);
  update invoices set bill_no = h->>'bill_no', bill_date = (h->>'bill_date')::date, party_id = party,
    party_name = h->>'party_name', contact = h->>'contact', payment_mode = h->>'payment_mode', tax_type = h->>'tax_type',
    bill_type = h->>'bill_type', salesman = h->>'salesman', ref_no = h->>'ref_no', gross = round(gross,2),
    discount = round(line_discount+bd,2), taxable = taxable, total_tax = tax,
    cgst = case when h->>'tax_type' = 'gst' then round(tax/2,2) else 0 end,
    sgst = case when h->>'tax_type' = 'gst' then round(tax/2,2) else 0 end,
    igst = case when h->>'tax_type' = 'igst' then tax else 0 end,
    other_exp = extra, freight = freight_value, cash_disc = cash_discount,
    round_off = round(net-before_round,2), net_total = net, remarks = h->>'remarks',
    shipping_address = h->>'shipping_address', billing_address = h->>'billing_address', journal_entry_id = je where id = inv.id;
  delete from invoice_items where invoice_id = inv.id;
  for l in select value from jsonb_array_elements(_lines) loop
    taxable := round(greatest(0,(l->>'quantity')::numeric*(l->>'rate')::numeric-coalesce((l->>'discount')::numeric,0))*ratio,2);
    tax := case when h->>'tax_type' = 'none' then 0 else round(taxable*(l->>'gst_rate')::numeric/100,2) end;
    insert into invoice_items(invoice_id,product_id,item_name,unit,quantity,free_qty,rate,discount,gst_rate,taxable,tax,amount)
    values(inv.id,(l->>'product_id')::uuid,l->>'item_name',l->>'unit',(l->>'quantity')::numeric,coalesce((l->>'free_qty')::numeric,0),(l->>'rate')::numeric,coalesce((l->>'discount')::numeric,0),(l->>'gst_rate')::numeric,taxable,tax,taxable+tax);
  end loop;
  return inv.id;
end $fn$;
revoke all on function public.update_sales_invoice(uuid,jsonb,jsonb) from public, anon;
grant execute on function public.update_sales_invoice(uuid,jsonb,jsonb) to authenticated;
notify pgrst, 'reload schema';
`;