import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Save, RefreshCw, Trash2, X, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSupabase } from "@/lib/supabase";
import { masterNames, productForm, productPayload, useMasters, type ProductForm, type MasterKind } from "@/lib/masters";
import { useWorkspaceCommands } from "@/lib/workspace-preferences";

export function ProductEditor({ product, onClose }: { product?: Record<string, any> | null; onClose: () => void }) {
 const sb = useSupabase(); const qc = useQueryClient(); const { data: masters = [], error: masterError } = useMasters();
 const [form,setForm] = useState(() => productForm(product)); const [busy,setBusy] = useState(false); const ref=useRef<HTMLFormElement>(null);
 useEffect(() => setForm(productForm(product)),[product]);
 const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => setForm(f=>({...f,[key]:value}));
 const field = (label: string, key: keyof ProductForm, type="text", kind?: MasterKind) => <label className="grid min-w-0 grid-cols-[105px_minmax(0,1fr)] items-center gap-2 text-xs"><span>{label}</span>{kind ? <><Input aria-label={label} list={`product-${key}`} value={String(form[key])} onChange={e=>set(key,e.target.value as never)}/><datalist id={`product-${key}`}>{masterNames(masters,kind,String(form[key])).map(n=><option key={n} value={n}/>)}</datalist></> : <Input aria-label={label} required={key==="name" || key==="unit"} type={type} step={type==="number"?"any":undefined} disabled={key==="quantity" && !!product} value={String(form[key])} onChange={e=>set(key,e.target.value as never)}/>}</label>;
 const check=(label:string,key:"sale_tax_incl"|"purchase_tax_incl"|"deactivated")=><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={form[key]} onChange={e=>set(key,e.target.checked)}/>{label}</label>;
 const save=async()=>{if(!sb || busy)return;setBusy(true);try {const {error}=await sb.rpc("save_product_master",{_id:product?.id??null,_data:productPayload(form),_old:product??null});if(error)throw error;await qc.invalidateQueries();toast.success("Product saved");onClose();}catch(e:any){toast.error(e.code==="PGRST202"?"Run the Product and Masters update on the Setup page before saving.":e.message??"Product was not saved");}finally{setBusy(false);}};
 const remove=async()=>{if(!sb||!product||busy||!confirm(`Delete ${product.name}?`))return;setBusy(true);try{const {error}=await sb.rpc("maintain_stock",{_action:"delete",_rows:[{id:product.id,quantity:product.quantity,old_barcode:product.barcode??"",old_sku:product.sku??"",old_name:product.name}]});if(error)throw error;await qc.invalidateQueries();toast.success("Product deleted");onClose();}catch(e:any){toast.error(e.message??"Product was not deleted");}finally{setBusy(false);}};
 useWorkspaceCommands({save:()=>ref.current?.requestSubmit(),refresh:()=>setForm(productForm(product))});
 return <form ref={ref} onSubmit={e=>{e.preventDefault();void save();}} className="product-master-form space-y-3">
  <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
   {field("Product Code","sku")}{field("Product Group","product_group","text","product_group")}
   {field("Product Name","name")}{field("Manufacturer","manufacturer","text","manufacturer")}
   {field("Category","category","text","category")}{field("Barcode","barcode")}
   {field("HSNCODE/SAC","hsn")}<div className="grid grid-cols-3 gap-2">{([['CGST%','cgst_rate'],['SGST%','sgst_rate'],['IGST%','igst_rate']] as const).map(([label,key])=><label key={key} className="min-w-0 text-xs"><span>{label}</span><Input aria-label={label} type="number" min="0" max="100" step="any" value={form[key]} onChange={e=>set(key,e.target.value)}/></label>)}</div>
   {field("Re Order Level","reorder_level","number")}<div className="flex flex-wrap items-center gap-3">{check("Inclusive of Tax Sales","sale_tax_incl")}{check("Inclusive of Tax Purchase","purchase_tax_incl")}</div>
  </div>
  <div className="grid gap-2 sm:grid-cols-3">{field("Purchase Rate","cost_price","number")}{field("Sales Rate","unit_price","number")}{field("MRP","mrp","number")}</div>
  <div className="grid gap-2 sm:grid-cols-2">{field("Main Unit","unit")}{field("Conv Factor","conv_factor","number")}{field("Alternate Unit","alt_unit")}{field("Opening Qty","quantity","number")}</div>
  <label className="grid grid-cols-[105px_minmax(0,1fr)] items-start gap-2 text-xs"><span>Remarks</span><textarea aria-label="Product remarks" className="h-12 w-full resize-y rounded-sm border border-input bg-background px-2 py-1" value={form.remarks} onChange={e=>set("remarks",e.target.value)}/></label>
  <div className="grid gap-2 sm:grid-cols-2">{field("Store location","store_location","text","store_location")}<Button variant="ghost" size="sm" asChild><Link to="/admin/masters"><Settings2 className="h-3 w-3"/>Masters</Link></Button></div>
  {masterError && <p className="text-xs text-destructive">Shared master options need the latest Setup update.</p>}
  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">{check("Deactive","deactivated")}<div className="flex flex-wrap gap-2"><Button type="submit" size="sm" disabled={busy}><Save className="h-3 w-3"/>Save</Button><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={()=>setForm(productForm(product))}><RefreshCw className="h-3 w-3"/>Refresh</Button><Button type="button" size="sm" variant="destructive" disabled={busy||!product||Number(product.quantity)!==0} onClick={()=>void remove()}><Trash2 className="h-3 w-3"/>Delete</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={onClose}><X className="h-3 w-3"/>Close</Button></div></div>
 </form>;
}
