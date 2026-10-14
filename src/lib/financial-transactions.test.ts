import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { SETUP_SQL, INVOICE_SQL, COMPANY_SQL, IMPORT_SQL } from './schema-sql';
import { INVOICE_ENTRY_SQL } from './invoice-entry-sql';
import { MASTERS_SQL } from './masters-sql';
import { FINANCIAL_TRANSACTIONS_SQL } from './financial-transactions-sql';
import { FINANCIAL_IMPORT_SQL } from "./financial-import-sql";
import { spreadsheetRecord } from "./data-transfer";
import { returnAllocation, returnLineTotals, savedItemPresentation } from "./invoice-calculations";
import { gstReport } from "./financial-reports";
import { totals, postInvoice, fetchOutstanding, fetchBalances, type Header, type Line } from './books';
import type { SupabaseClient } from '@supabase/supabase-js';
const user='10000000-0000-0000-0000-000000000001';
const company='20000000-0000-0000-0000-000000000001';
const product='30000000-0000-0000-0000-000000000001';
const customer='40000000-0000-0000-0000-000000000001';
const supplier='40000000-0000-0000-0000-000000000002';
const header:Header={bill_no:'AUDIT',bill_date:'2026-10-10',party_name:'Customer',contact:'',payment_mode:'cash',tax_type:'gst',bill_type:'B2CS',salesman:'',ref_no:'',bill_discount:0,other_exp:0,freight:0,cash_disc:0,remarks:'',shipping_address:'',billing_address:''};
const line:Line={product_id:product,item_name:'Audit product',barcode:'AUDIT',sku:'AUDIT',unit:'pcs',quantity:2,free_qty:0,rate:100,discount:0,gst_rate:18,profit_pct:0};
async function database(){
 const db=new PGlite();
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
 insert into auth.users values('${user}'); select set_config('test.user','${user}',false);`);
 await db.exec(SETUP_SQL+INVOICE_SQL+COMPANY_SQL+IMPORT_SQL+INVOICE_ENTRY_SQL+MASTERS_SQL+FINANCIAL_TRANSACTIONS_SQL+FINANCIAL_IMPORT_SQL);
 await db.exec(`insert into companies(id,owner_id,name) values('${company}','${user}','Audit company');
 insert into user_settings(user_id,active_company_id) values('${user}','${company}');
 insert into products(id,name,unit,sku,barcode,quantity,cost_price,unit_price,gst_rate) values('${product}','Audit product','pcs','AUDIT','AUDIT',100,100,100,18);
 insert into customers(id,name,party_type) values('${customer}','Customer','customer'),('${supplier}','Supplier','supplier');
 set role authenticated;`);
 return db;
}
async function rpc(db:PGlite,name:string,args:unknown[]){
 const q=await db.query<{result:any}>(`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args.map(a=>a !== null && typeof a==='object'?JSON.stringify(a):a));
 return q.rows[0]?.result;
}
async function n(db:PGlite,sql:string){const q=await db.query<{v:string|number}>(sql);return Number(q.rows[0]?.v);}
async function snapshot(db:PGlite){return (await db.query(`select jsonb_build_object(${['products','customers','accounts','journal_entries','journal_lines','invoices','invoice_items','payments','sales_returns','sales_return_items','stock_movements','financial_requests'].map(t=>`'${t}',(select coalesce(jsonb_agg(x order by x::text),'[]') from (select to_jsonb(t) x from ${t} t) s)`).join(',')}) data`)).rows;}
describe('real PostgreSQL financial matrix',()=>{
 it('GST, IGST and No Tax × cash and credit for sales and purchase reconcile with settlements, edits and partial/full returns',async()=>{
  const db=await database();
  try{
   for(const kind of ['sale','purchase'])for(const tax_type of ['gst','igst','none'])for(const mode of ['cash','credit']){
    const h={...header,bill_no:`${kind}-${tax_type}-${mode}`,party_name:kind==='sale'?'Customer':'Supplier',tax_type,payment_mode:mode};
    const key=crypto.randomUUID();
    const beforeStock=await n(db,`select quantity v from products where id='${product}'`);
    const id=await rpc(db,'post_financial_invoice',[kind,h,[line],key,null]);
    assert.equal(await rpc(db,'post_financial_invoice',[kind,h,[line],key,null]),id,'retry returns original bill');
    const inv=(await db.query<any>('select * from invoices where id=$1',[id])).rows[0];
    assert.equal(Number(inv.net_total),tax_type==='none'?200:236);
    assert.equal(Number(inv.total_tax),tax_type==='none'?0:36);
    assert.equal(Number(inv.cgst),tax_type==='gst'?18:0);
    assert.equal(Number(inv.sgst),tax_type==='gst'?18:0);
    assert.equal(Number(inv.igst),tax_type==='igst'?36:0);
    assert.equal(Number(inv.taxable),200);
    assert.equal(await n(db,`select quantity v from products where id='${product}'`),beforeStock+(kind==='sale'?-2:2));
    assert.equal(await n(db,`select sum(amount) v from invoice_items where invoice_id='${id}'`),tax_type==='none'?200:236);
    assert.equal(await n(db,`select sum(debit-credit) v from journal_lines where entry_id='${inv.journal_entry_id}'`),0);
    const payCode=mode==='credit'?(kind==='sale'?'1100':'2000'):'1000';
    assert.equal(await n(db,`select sum(${kind==='sale'?'debit-credit':'credit-debit'}) v from journal_lines j join accounts a on a.id=j.account_id where entry_id='${inv.journal_entry_id}' and a.code='${payCode}'`),Number(inv.net_total));
    if(kind==='sale'){
     const edited={...h,bill_discount:10};
     assert.equal(await rpc(db,'post_financial_invoice',['sale',edited,[line],crypto.randomUUID(),id]),id);
     const expected=totals([line],edited);assert.equal(await n(db,`select net_total v from invoices where id='${id}'`),expected.net_total);
     if(mode==='credit'){
      const p={kind:'receipt',voucher_no:`RV-${tax_type}`,pay_date:'2026-10-10',party_id:customer,party_name:'Customer',amount:50,mode:'cash',reference:'',notes:''};
      const pk=crypto.randomUUID();const pi=await rpc(db,'post_financial_payment',[p,pk]);assert.equal(await rpc(db,'post_financial_payment',[p,pk]),pi);
     }
     const item=(await db.query<any>('select * from invoice_items where invoice_id=$1',[id])).rows[0];
     let returned=0;
     for(let r=1;r<=2;r++){
      const payload={invoice_id:id,return_no:`SR-${tax_type}-${mode}-${r}`,return_date:'2026-10-10',refund_mode:mode,reason:'Audit',lines:[{invoice_item_id:item.id,qty:1}]};
      const rk=crypto.randomUUID();const amount=Number(await rpc(db,'post_financial_return',[payload,rk]));returned+=amount;
      assert.equal(Number(await rpc(db,'post_financial_return',[payload,rk])),amount);
     }
     assert.equal(returned,expected.net_total,'full returned amount equals rounded discounted bill');
     assert.equal(await n(db,`select quantity v from products where id='${product}'`),beforeStock);
     assert.equal(await n(db,`select sum(total_tax) v from sales_returns where invoice_id='${id}'`),expected.total_tax);
     await assert.rejects(rpc(db,'post_financial_return',[{invoice_id:id,return_no:'EXCESS',return_date:'2026-10-10',refund_mode:mode,lines:[{invoice_item_id:item.id,qty:1}]},crypto.randomUUID()]),/exceeds/);
     await assert.rejects(rpc(db,'post_financial_invoice',['sale',h,[line],crypto.randomUUID(),id]),/returns/);
    }else if(mode==='credit'){
     await rpc(db,'post_financial_payment',[{kind:'payment',voucher_no:`PV-${tax_type}`,pay_date:'2026-10-10',party_id:supplier,party_name:'Supplier',amount:Number(inv.net_total),mode:'cash',reference:'',notes:''},crypto.randomUUID()]);
    }
    console.log(`MATRIX PASS ${kind} / ${tax_type} / ${mode}`);
   }
   assert.equal(await n(db,'select sum(debit-credit) v from journal_lines'),0);
   assert.equal(await n(db,`select sum(j.credit-j.debit) v from journal_lines j join accounts a on a.id=j.account_id where a.code='2000'`),0,'supplier payments clear payable');
   assert.equal(await n(db,`select sum(j.debit-j.credit) v from journal_lines j join accounts a on a.id=j.account_id where a.code='1100'`),-150,'receipts then full credit return leave customer advance');
   const netReport=await n(db,`select (select sum(total_tax) from invoices where kind='sale')-(select sum(total_tax) from sales_returns)-(select sum(total_tax) from invoices where kind='purchase') v`);
   const netLedger=await n(db,`select sum(case when a.code='2100' then j.credit-j.debit else j.credit-j.debit end) v from journal_lines j join accounts a on a.id=j.account_id where a.code in ('2100','1200')`);
   const invoiceRows=(await db.query<any>('select * from invoices')).rows;
   const returnRows=(await db.query<any>('select * from sales_returns')).rows;
   const report = gstReport(invoiceRows.map(i=>({...i,bill_date:i.bill_date.toISOString().slice(0,10)})), returnRows.map(r=>({...r,return_date:r.return_date.toISOString().slice(0,10)})));
   assert.equal(report.length,1);assert.equal(report[0]?.net,netLedger,'actual reports calculator reconciles with journal');
   const readAdapter={from(table:string){const q={select(){return q;},order(){return q;},range(){return q;},then(resolve:any,reject:any){return db.query<any>('select * from '+table).then(r=>resolve({data:r.rows,error:null}),reject);}};return q;}} as unknown as SupabaseClient;
   const outstanding=await fetchOutstanding(readAdapter);
   assert.equal(outstanding.rows.filter(r=>r.side==='supplier').reduce((sum,r)=>sum+r.balance,0),0);
   assert.equal(outstanding.rows.filter(r=>r.side==='customer').reduce((sum,r)=>sum+r.balance,0),-150);
   assert.equal(netReport,netLedger,'GST report reconciles with input/output tax ledger');
   assert.equal(await n(db,`select sum(total_tax) v from invoices where kind='purchase'`),144);
  }finally{await db.close();}
 });
 it('multi-item fractional tax, freebies, extras and partial returns reconcile exactly to the rounded bill',async()=>{
  const db=await database();try{
   const h={...header,bill_no:'FRACTIONAL',bill_discount:0.03,other_exp:0.11,freight:0.13,cash_disc:0.07};
   const lines=[{...line,quantity:3,free_qty:1,rate:0.37,gst_rate:18},{...line,quantity:3,free_qty:0,rate:0.41,gst_rate:5},{...line,quantity:3,rate:0.29,gst_rate:12}];
   const expected=totals(lines,h);const id=await rpc(db,'post_financial_invoice',['sale',h,lines,crypto.randomUUID(),null]);
   const inv=(await db.query<any>('select * from invoices where id=$1',[id])).rows[0];
   assert.equal(Number(inv.total_tax),expected.total_tax);assert.equal(Number(inv.net_total),expected.net_total);
   assert.equal(Number(inv.cgst)+Number(inv.sgst),Number(inv.total_tax));
   const items=(await db.query<any>('select * from invoice_items where invoice_id=$1 order by id',[id])).rows;
   let total=0;
   for(let part=1;part<=3;part++)total+=Number(await rpc(db,'post_financial_return',[{invoice_id:id,return_no:'FRACTION-'+part,return_date:'2026-10-10',refund_mode:'cash',lines:items.map((i:any)=>({invoice_item_id:i.id,qty:1}))},crypto.randomUUID()]));
   assert.equal(total,expected.net_total);assert.equal(await n(db,`select quantity v from products where id='${product}'`),100);
   assert.equal(await n(db,`select sum(total_tax) v from sales_returns where invoice_id='${id}'`),expected.total_tax);
  }finally{await db.close();}
 });
 it('purchase edits, alternate units, print snapshots, opening balances and protected history',async()=>{
  const db=await database();try{
   await db.exec(`update products set alt_unit='box',conv_factor=10,hsn='8544' where id='${product}';update customers set opening_balance=100,gstin='32TEST' where id='${customer}';update customers set opening_balance=70 where id='${supplier}';update companies set terms='Saved terms' where id='${company}';`);
   const h={...header,bill_no:'ALT',party_id:customer,entry_details:{kfc_amount:'5'}};
   const alt={...line,unit:'box',unit_factor:10,quantity:2,rate:1000};
   const id=await rpc(db,'post_financial_invoice',['sale',h,[alt],crypto.randomUUID(),null]);
   assert.equal(await n(db,`select quantity v from products where id='${product}'`),80);
   const inv=(await db.query<any>('select * from invoices where id=$1',[id])).rows[0];
   assert.equal(Number(inv.net_total),2365);assert.equal(inv.entry_details.party_gstin,'32TEST');assert.equal(inv.entry_details.company.terms,'Saved terms');
   const item=(await db.query<any>('select * from invoice_items where invoice_id=$1',[id])).rows[0];assert.equal(item.entry_details.hsn,'8544');
   await db.exec(`update products set hsn='NEW' where id='${product}';update customers set gstin='NEW' where id='${customer}';`);
   assert.equal(savedItemPresentation(item,inv).amount,2360);
   await assert.rejects(db.exec(`delete from customers where id='${customer}'`),/linked business history/,'linked party deletion');
   await assert.rejects(db.exec(`delete from accounts where code='1000'`),/linked business history/,'linked account deletion');
   await assert.rejects(db.exec(`delete from journal_lines where entry_id='${inv.journal_entry_id}'`),/linked business history/,'linked line deletion');
   const alloc=returnAllocation([item],inv);assert.equal(returnLineTotals({sold:2,returned:0,qty:1,allocation:alloc.get(item.id) || 0,taxableTotal:Number(item.taxable),taxTotal:Number(item.tax)}).amount,1182.5);
   await rpc(db,'post_financial_return',[{invoice_id:id,return_no:'ALT-RETURN',return_date:'2026-10-10',refund_mode:'cash',lines:[{invoice_item_id:item.id,qty:1}]},crypto.randomUUID()]);
   assert.equal(await n(db,`select quantity v from products where id='${product}'`),90);
   const purchase=await rpc(db,'post_financial_invoice',['purchase',{...header,bill_no:'EDIT-P',party_name:'Supplier'},[line],crypto.randomUUID(),null]);
   await rpc(db,'post_financial_invoice',['purchase',{...header,bill_no:'EDIT-P',party_name:'Supplier'},[{...line,quantity:3}],crypto.randomUUID(),purchase]);
   assert.equal(await n(db,`select quantity v from products where id='${product}'`),93);
   const adapter={from(table:string){const q={select(){return q;},order(){return q;},range(){return q;},then(resolve:any,reject:any){return db.query<any>('select * from '+table).then(r=>resolve({data:r.rows,error:null}),reject);}};return q;}} as unknown as SupabaseClient;
   const balances=await fetchBalances(adapter);assert.equal(balances.find(a=>a.code==='1100')?.opening_balance,100);
   const outstanding=await fetchOutstanding(adapter);assert.equal(outstanding.rows.find(r=>r.party_id===customer)?.balance,100);assert.equal(outstanding.rows.find(r=>r.party_id===supplier)?.balance,70);
  }finally{await db.close();}
 });
 it('Excel stock and tax changes commit with movements and roll back the whole sheet on errors',async()=>{
  const db=await database();try{
   const rec=spreadsheetRecord('products',{'Item Code':'AUDIT','Item Name':'Audit product','Barcode':'AUDIT','Unit':'pcs','Quantity':125,'CGST %':5,'SGST %':7,'IGST %':18});
   const result=await rpc(db,'import_business_rows',['products',[rec],true,crypto.randomUUID()]);assert.equal(result.updated,1);
   assert.equal(await n(db,`select quantity v from products where id='${product}'`),125);assert.equal(await n(db,`select igst_rate v from products where id='${product}'`),18);
   assert.equal(await n(db,`select sum(quantity) v from stock_movements where product_id='${product}'`),25);
   const before=await snapshot(db);await assert.rejects(rpc(db,'import_business_rows',['products',[{...rec,quantity:130},{...rec,sku:'BAD',barcode:'BAD',quantity:-1}],true,crypto.randomUUID()]),/Invalid/);assert.deepEqual(await snapshot(db),before);
   const ledger=spreadsheetRecord('ledgers',{'Ledger Code':'8000','Ledger Name':'Expenses','Group':'expense','Opening Balance':150});
   await rpc(db,'import_business_rows',['ledgers',[ledger],true,crypto.randomUUID()]);assert.equal(await n(db,`select opening_balance v from accounts where code='8000'`),150);
  }finally{await db.close();}
 });
 it('late failures roll back every financial table for invoice, payment, return, stock and journal',async()=>{
  const db=await database();try{
   await db.exec(`reset role; create function fail_audit() returns trigger language plpgsql as $$ begin raise exception 'Injected late failure'; end $$; set role authenticated;`);
   const id=await rpc(db,'post_financial_invoice',['sale',header,[line],crypto.randomUUID(),null]);
   const item=(await db.query<any>('select id from invoice_items where invoice_id=$1',[id])).rows[0];
   const cash=await rpc(db,'financial_account',['1000','Cash','asset']);const sales=await rpc(db,'financial_account',['4000','Sales','income']);
   const cases:[string,string,unknown[]][]=[
    ['invoice_items','post_financial_invoice',['purchase',{...header,bill_no:'FAIL',party_name:'New supplier'},[{...line,product_id:null,sku:'NEW',barcode:'NEW'}],crypto.randomUUID(),null]],
    ['invoice_items','post_financial_invoice',['sale',{...header,bill_no:'EDIT'},[{...line,quantity:3}],crypto.randomUUID(),id]],
    ['payments','post_financial_payment',[{kind:'receipt',voucher_no:'FAIL',pay_date:'2026-10-10',party_id:customer,amount:10,mode:'cash'},crypto.randomUUID()]],
    ['sales_return_items','post_financial_return',[{invoice_id:id,return_no:'FAIL',return_date:'2026-10-10',refund_mode:'cash',lines:[{invoice_item_id:item.id,qty:1}]},crypto.randomUUID()]],
    ['products','post_financial_stock',[product,{mode:'in',quantity:2},crypto.randomUUID()]],
    ['journal_lines','post_financial_journal',[{entry_date:'2026-10-10',reference:'FAIL'},[{account_id:cash,debit:10,credit:0},{account_id:sales,debit:0,credit:10}],crypto.randomUUID()]],
   ];
   for(const [table,name,args] of cases){
    await db.exec(`reset role;create trigger inject_failure before insert or update on ${table} for each row execute function fail_audit();set role authenticated;`);
    const before=await snapshot(db);await assert.rejects(rpc(db,name,args),/Injected late failure/);assert.deepEqual(await snapshot(db),before,`${name} rollback includes stock, ledger, parties and retry records`);
    await db.exec(`reset role;drop trigger inject_failure on ${table};set role authenticated;`);
   }
   await assert.rejects(db.query('delete from journal_entries where id=(select journal_entry_id from invoices where id=$1)',[id]),/Cannot delete/);
   const before=await snapshot(db);await assert.rejects(rpc(db,'post_financial_invoice',['sale',{...header,bill_no:'TOO-MUCH'},[{...line,quantity:1000}],crypto.randomUUID(),null]),/Not enough stock/);assert.deepEqual(await snapshot(db),before);
  }finally{await db.close();}
 });
 it('company policies reject foreign products and retry identifiers cannot be reused with changed data',async()=>{
  const db=await database();try{
   const key=crypto.randomUUID();await rpc(db,'post_financial_invoice',['sale',header,[line],key,null]);
   await assert.rejects(rpc(db,'post_financial_invoice',['sale',{...header,bill_no:'DIFFERENT'},[line],key,null]),/different data/);
   await db.exec(`reset role;insert into companies(id,owner_id,name) values('20000000-0000-0000-0000-000000000002','${user}','Other company');insert into products(id,company_id,name,quantity) values('30000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','Other',10);set role authenticated;`);
   await assert.rejects(rpc(db,'post_financial_invoice',['sale',{...header,bill_no:'FOREIGN'},[{...line,product_id:'30000000-0000-0000-0000-000000000002'}],crypto.randomUUID(),null]),/not available/);
  }finally{await db.close();}
 });
});
describe('financial client failure handling',()=>{
 it('uses one RPC, preserves identifier on uncertain retries, and never falls back to partial writes',async()=>{
  const keys:string[]=[];let attempt=0;
  const sb={rpc:async(_name:string,p:any)=>{keys.push(p._request_key);attempt++;return attempt===1?{data:null,error:{message:'Network interrupted'}}:{data:'saved-id',error:null};},from:()=>{throw new Error('No partial writes allowed');}} as unknown as SupabaseClient;
  await assert.rejects(postInvoice(sb,'sale',header,[line]),/Network interrupted/);
  assert.equal(await postInvoice(sb,'sale',header,[line]),'saved-id');assert.equal(keys[0],keys[1]);
 });
 it('missing installed transaction stops saving',async()=>{
  const sb={rpc:async()=>({data:null,error:{code:'PGRST202'}}),from:()=>{throw new Error('No fallback');}} as unknown as SupabaseClient;
  await assert.rejects(postInvoice(sb,'sale',header,[line]),/Financial transactions update/);
 });
});
