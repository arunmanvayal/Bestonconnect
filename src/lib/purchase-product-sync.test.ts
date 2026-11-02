import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { SETUP_SQL, INVOICE_SQL, COMPANY_SQL, IMPORT_SQL } from './schema-sql';
import { INVOICE_ENTRY_SQL } from './invoice-entry-sql';
import { MASTERS_SQL } from './masters-sql';
import { FINANCIAL_TRANSACTIONS_SQL } from './financial-transactions-sql';
import { PURCHASE_PRODUCT_SYNC_SQL, ALL_PRODUCTS_INCLUSIVE_18_SQL } from './purchase-product-sync-sql';
const user='10000000-0000-0000-0000-000000000001', company='20000000-0000-0000-0000-000000000001', product='30000000-0000-0000-0000-000000000001';
const header={bill_no:'P1',bill_date:'2026-10-10',party_name:'Supplier',contact:'',payment_mode:'cash',tax_type:'gst',bill_type:'B2CS',salesman:'',ref_no:'',bill_discount:0,other_exp:0,freight:0,cash_disc:0,remarks:'',shipping_address:'',billing_address:''};
async function db(){
 const d=new PGlite();
 await d.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 insert into auth.users values('${user}'); select set_config('test.user','${user}',false);`);
 await d.exec(SETUP_SQL+INVOICE_SQL+COMPANY_SQL+IMPORT_SQL+INVOICE_ENTRY_SQL+MASTERS_SQL+FINANCIAL_TRANSACTIONS_SQL+PURCHASE_PRODUCT_SYNC_SQL);
 await d.exec(`insert into companies(id,owner_id,name) values('${company}','${user}','C'); insert into user_settings(user_id,active_company_id) values('${user}','${company}');
 insert into products(id,name,unit,quantity,cost_price,unit_price,mrp,gst_rate) values('${product}','P','pcs',10,50,60,70,5); set role authenticated;`);
 return d;
}
const row=async(d:PGlite)=>(await d.query<any>(`select * from products where id='${product}'`)).rows[0];
const post=(d:PGlite,line:object)=>d.query(`select post_financial_invoice('purchase',$1,$2,$3,null)`,[JSON.stringify(header),JSON.stringify([{product_id:product,item_name:'P',unit:'pcs',quantity:1,free_qty:0,discount:0,profit_pct:0,...line}]),crypto.randomUUID()]);
describe('purchase bill updates product details',()=>{
 it('one-time step sets all products 18% (9+9) inclusive',async()=>{const d=await db();try{await d.exec(ALL_PRODUCTS_INCLUSIVE_18_SQL);const p=await row(d);
  assert.equal(p.sale_tax_incl,true);assert.equal(p.purchase_tax_incl,true);assert.equal(Number(p.cgst_rate),9);assert.equal(Number(p.sgst_rate),9);assert.equal(Number(p.gst_rate),18);}finally{await d.close();}});
 it('latest GST %, inclusive purchase rate, sale price and MRP are saved to the product',async()=>{const d=await db();try{
  await d.exec(ALL_PRODUCTS_INCLUSIVE_18_SQL);
  await post(d,{rate:100,gst_rate:12,sale_price:150,mrp:180});
  const p=await row(d);assert.equal(Number(p.gst_rate),12);assert.equal(Number(p.cgst_rate),6);assert.equal(Number(p.sgst_rate),6);assert.equal(Number(p.igst_rate),12);
  assert.equal(Number(p.cost_price),112);assert.equal(Number(p.unit_price),150);assert.equal(Number(p.mrp),180);}finally{await d.close();}});
 it('exclusive products keep the pre-tax purchase rate',async()=>{const d=await db();try{
  await post(d,{rate:100,gst_rate:18,sale_price:130,mrp:140});const p=await row(d);assert.equal(Number(p.cost_price),100);assert.equal(Number(p.gst_rate),18);}finally{await d.close();}});
});
