/** Setup 18: cancel a saved sale/purchase bill or sales return, reversing stock and ledger in one transaction. */
export const CANCEL_TRANSACTIONS_SQL = String.raw`
create or replace function public.cancel_financial_invoice(_invoice_id uuid) returns void
language plpgsql security invoker set search_path=public as $fn$
declare cid uuid:=current_company(); inv invoices%rowtype; r record; qty numeric;
begin
 select * into inv from invoices where id=_invoice_id and company_id=cid for update;
 if not found then raise exception 'Bill not found in this company'; end if;
 if exists(select 1 from sales_returns where invoice_id=inv.id) then raise exception 'Cancel the sales returns of this bill first'; end if;
 perform set_config('businessdesk.financial_write',cid::text,true);
 for r in select product_id, sum((quantity+coalesce(free_qty,0))*coalesce((entry_details->>'unit_factor')::numeric,1)) q
   from invoice_items where invoice_id=inv.id and product_id is not null group by product_id order by product_id loop
  select quantity into qty from products where id=r.product_id and company_id=cid for update;
  if not found then continue; end if;
  qty:=qty+case when inv.kind='sale' then r.q else -r.q end;
  if qty<0 then raise exception 'Not enough stock to cancel this purchase; items were already sold'; end if;
  update products set quantity=qty where id=r.product_id and company_id=cid;
  insert into stock_movements(company_id,product_id,type,quantity,note) values(cid,r.product_id,case when inv.kind='sale' then 'in' else 'out' end,r.q,'Cancelled bill ' || inv.bill_no);
 end loop;
 delete from invoices where id=inv.id and company_id=cid;
 if inv.journal_entry_id is not null then
  delete from journal_lines where entry_id=inv.journal_entry_id and company_id=cid;
  delete from journal_entries where id=inv.journal_entry_id and company_id=cid;
 end if;
 perform set_config('businessdesk.financial_write','',true);
end $fn$;

create or replace function public.cancel_sales_return(_return_id uuid) returns void
language plpgsql security invoker set search_path=public as $fn$
declare cid uuid:=current_company(); ret sales_returns%rowtype; r record; qty numeric;
begin
 select * into ret from sales_returns where id=_return_id and company_id=cid for update;
 if not found then raise exception 'Return not found in this company'; end if;
 perform set_config('businessdesk.financial_write',cid::text,true);
 for r in select ri.product_id, sum((ri.quantity+coalesce(ii.free_qty,0)*ri.quantity/nullif(ii.quantity,0))*coalesce((ii.entry_details->>'unit_factor')::numeric,1)) q
   from sales_return_items ri left join invoice_items ii on ii.id=ri.invoice_item_id
   where ri.return_id=ret.id and ri.product_id is not null group by ri.product_id order by ri.product_id loop
  select quantity into qty from products where id=r.product_id and company_id=cid for update;
  if not found then continue; end if;
  qty:=qty-r.q;
  if qty<0 then raise exception 'Not enough stock to cancel this return; items were already sold again'; end if;
  update products set quantity=qty where id=r.product_id and company_id=cid;
  insert into stock_movements(company_id,product_id,type,quantity,note) values(cid,r.product_id,'out',r.q,'Cancelled return ' || ret.return_no);
 end loop;
 delete from sales_returns where id=ret.id and company_id=cid;
 if ret.journal_entry_id is not null then
  delete from journal_lines where entry_id=ret.journal_entry_id and company_id=cid;
  delete from journal_entries where id=ret.journal_entry_id and company_id=cid;
 end if;
 perform set_config('businessdesk.financial_write','',true);
end $fn$;

revoke all on function public.cancel_financial_invoice(uuid) from public,anon;
revoke all on function public.cancel_sales_return(uuid) from public,anon;
grant execute on function public.cancel_financial_invoice(uuid) to authenticated;
grant execute on function public.cancel_sales_return(uuid) to authenticated;
notify pgrst, 'reload schema';
`;
