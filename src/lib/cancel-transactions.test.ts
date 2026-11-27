import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { SETUP_SQL, INVOICE_SQL, COMPANY_SQL, IMPORT_SQL } from './schema-sql';
import { INVOICE_ENTRY_SQL } from './invoice-entry-sql';
import { MASTERS_SQL } from './masters-sql';
import { FINANCIAL_TRANSACTIONS_SQL } from './financial-transactions-sql';
import { CANCEL_TRANSACTIONS_SQL } from './cancel-sql';
const user='10000000-0000-0000-0000-000000000001', company='20000000-0000-0000-0000-000000000001', product='30000000-0000-0000-0000-000000000001';
const header=(bill:string)=>({bill_no:bill,bill_date:'2026-10-10',party_name:'',contact:'',payment_mode:'cash',tax_type:'gst',bill_type:'B2CS',salesman:'',ref_no:'',bill_discount:0,other_exp:0,freight:0,cash_disc:0,remarks:'',shipping_address:'',billing_address:''});
const line=(q:number)=>({product_id:product,item_name:'P',unit:'pcs',quantity:q,free_qty:0,rate:100,discount:0,gst_rate:18,profit_pct:0});
async function db(){
 const d=new PGlite();
 await d.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 insert into auth.users values('${user}'); select set_config('test.user','${user}',false);`);
 await d.exec(SETUP_SQL+INVOICE_SQL+COMPANY_SQL+IMPORT_SQL+INVOICE_ENTRY_SQL+MASTERS_SQL+FINANCIAL_TRANSACTIONS_SQL+CANCEL_TRANSACTIONS_SQL);
 await d.exec(`insert into companies(id,owner_id,name) values('${company}','${user}','C'); insert into user_settings(user_id,active_company_id) values('${user}','${company}');
 insert into products(id,name,unit,quantity,cost_price,unit_price,mrp,gst_rate) values('${product}','P','pcs',10,50,60,70,18); set role authenticated;`);
 return d;
}
const stock=async(d:PGlite)=>Number((await d.query<any>(`select quantity from products where id='${product}'`)).rows[0].quantity);
const count=async(d:PGlite,t:string)=>Number((await d.query<any>(`select count(*) c from ${t}`)).rows[0].c);
const post=async(d:PGlite,kind:string,bill:string,q:number)=>(await d.query<any>(`select post_financial_invoice($1,$2,$3,$4,null) id`,[kind,JSON.stringify(header(bill)),JSON.stringify([line(q)]),crypto.randomUUID()])).rows[0].id;
describe('cancel bills and returns',()=>{
 it('cancelling a sale restores stock and removes its ledger entry',async()=>{const d=await db();try{
  const id=await post(d,'sale','S1',3);assert.equal(await stock(d),7);
  await d.query(`select cancel_financial_invoice($1)`,[id]);
  assert.equal(await stock(d),10);assert.equal(await count(d,'invoices'),0);assert.equal(await count(d,'journal_entries'),0);assert.equal(await count(d,'journal_lines'),0);}finally{await d.close();}});
 it('cancelling a purchase removes its stock',async()=>{const d=await db();try{
  const id=await post(d,'purchase','P1',5);assert.equal(await stock(d),15);
  await d.query(`select cancel_financial_invoice($1)`,[id]);assert.equal(await stock(d),10);}finally{await d.close();}});
 it('a purchase whose stock was already sold cannot be cancelled',async()=>{const d=await db();try{
  const id=await post(d,'purchase','P1',5);await post(d,'sale','S1',14);
  await assert.rejects(d.query(`select cancel_financial_invoice($1)`,[id]),/Not enough stock/);assert.equal(await stock(d),1);}finally{await d.close();}});
 it('cancelling a return takes the stock back out; bill with return cannot be cancelled until then',async()=>{const d=await db();try{
  const id=await post(d,'sale','S1',4);const item=(await d.query<any>(`select id from invoice_items`)).rows[0].id;
  await d.query(`select post_financial_return($1,$2)`,[JSON.stringify({invoice_id:id,return_no:'SR-1',return_date:'2026-10-11',refund_mode:'cash',lines:[{invoice_item_id:item,qty:2}]}),crypto.randomUUID()]);
  assert.equal(await stock(d),8);
  await assert.rejects(d.query(`select cancel_financial_invoice($1)`,[id]),/returns/);
  const ret=(await d.query<any>(`select id from sales_returns`)).rows[0].id;
  await d.query(`select cancel_sales_return($1)`,[ret]);assert.equal(await stock(d),6);assert.equal(await count(d,'sales_returns'),0);
  await d.query(`select cancel_financial_invoice($1)`,[id]);assert.equal(await stock(d),10);assert.equal(await count(d,'journal_entries'),0);}finally{await d.close();}});
});
