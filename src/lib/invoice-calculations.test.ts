import { describe,it } from 'node:test';
import assert from 'node:assert/strict';
import { savedItemPresentation, returnAllocation, returnLineTotals, moneyRound } from './invoice-calculations';
import { spreadsheetRecord } from './data-transfer';
describe('shared document calculations',()=>{
 it('prints the effective bill discount and IGST without inventing CGST',()=>{
  const p=savedItemPresentation({quantity:2,rate:100,discount:0,taxable:180,tax:32.4,amount:212.4,gst_rate:18},{tax_type:'igst'});
  assert.equal(p.discount,20);assert.equal(p.discountPercent,10);assert.equal(p.igst,32.4);assert.equal(p.cgst,0);assert.equal(p.amount,212.4);
 });
 it('zero value items allocate charges and round partial returns exactly',()=>{
  const allocations=returnAllocation([{id:'a',quantity:3,amount:0},{id:'b',quantity:1,amount:0}],{net_total:1});
  assert.equal(allocations.get('a'),0.75);assert.equal(allocations.get('b'),0.25);
  assert.equal(returnLineTotals({sold:3,returned:1,qty:1,allocation:1,taxableTotal:0,taxTotal:0}).amount,0.34);
  assert.equal(moneyRound(-0.005),-0.01);
 });
 it('Excel keeps independent GST components and ledger opening balance',()=>{
  const p=spreadsheetRecord('products',{'Item Name':'Wire','CGST %':5,'SGST %':7,'IGST %':18});
  assert.equal(p.cgst_rate,5);assert.equal(p.sgst_rate,7);assert.equal(p.igst_rate,18);assert.equal(p.gst_rate,12);
  assert.deepEqual(spreadsheetRecord('ledgers',{'Ledger Code':'8000','Ledger Name':'Expenses',Group:'expense','Opening Balance':150}),{code:'8000',name:'Expenses',type:'expense',opening_balance:150});
 });
});
