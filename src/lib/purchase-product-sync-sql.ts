/** Setup 16: after a purchase bill commits, copy its latest entered values back to each product. */
export const PURCHASE_PRODUCT_SYNC_SQL = String.raw`
create or replace function public.sync_product_from_purchase_item() returns trigger
language plpgsql security invoker set search_path = public as $fn$
declare inv invoices%rowtype; f numeric; g numeric;
begin
 if new.product_id is null or not exists(select 1 from invoice_items where id = new.id) then return null; end if;
 select * into inv from invoices where id = new.invoice_id;
 if not found or inv.kind <> 'purchase' then return null; end if;
 f := coalesce(nullif((new.entry_details->>'unit_factor'),'')::numeric, 1); if f <= 0 then f := 1; end if;
 g := coalesce(new.gst_rate, 0);
 update products p set
  gst_rate = case when inv.tax_type = 'none' then p.gst_rate else g end,
  cgst_rate = case when inv.tax_type = 'none' then p.cgst_rate else round(g/2, 2) end,
  sgst_rate = case when inv.tax_type = 'none' then p.sgst_rate else g - round(g/2, 2) end,
  igst_rate = case when inv.tax_type = 'none' then p.igst_rate else g end,
  cost_price = round(new.rate / f * case when p.purchase_tax_incl and inv.tax_type <> 'none' then 1 + g/100 else 1 end, 2),
  unit_price = coalesce(nullif(new.entry_details->>'sale_price','')::numeric / f, p.unit_price),
  mrp = coalesce(nullif(new.entry_details->>'mrp','')::numeric, p.mrp)
 where p.id = new.product_id and p.company_id = inv.company_id;
 return null;
end $fn$;
drop trigger if exists sync_product_from_purchase on invoice_items;
create constraint trigger sync_product_from_purchase after insert on invoice_items
 deferrable initially deferred for each row execute function public.sync_product_from_purchase_item();
revoke all on function public.sync_product_from_purchase_item() from public, anon;
grant execute on function public.sync_product_from_purchase_item() to authenticated;
`;

/** Setup 17: one-time change marking every product 18% (9+9) inclusive for sales and purchase. */
export const ALL_PRODUCTS_INCLUSIVE_18_SQL = String.raw`
update public.products set sale_tax_incl = true, purchase_tax_incl = true,
 cgst_rate = 9, sgst_rate = 9, igst_rate = 18, gst_rate = 18
where company_id in (select id from companies);
`;
