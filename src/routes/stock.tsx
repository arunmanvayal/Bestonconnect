import { fetchAll } from "@/lib/data-transfer";
import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { adjustStock } from "@/lib/books";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate, money } from "@/components/SupabaseGate";
import { useSupabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useWorkspaceCommands, useWorkspacePreferences } from "@/lib/workspace-preferences";

export const Route = createFileRoute("/stock")({
  head: () => ({
    meta: [
      { title: "Stock Management — BusinessDesk" },
      { name: "description", content: "Inventory and stock management: products, quantities and stock movements." },
      { property: "og:title", content: "Stock Management — BusinessDesk" },
      { property: "og:description", content: "Inventory and stock management: products, quantities and stock movements." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StockPage,
});

const EMPTY_PRODUCT = { sku: "", name: "", unit: "pcs", quantity: "0", reorder_level: "0", unit_price: "0" };

function StockPage() {
  return (
    <AppLayout>
      <SupabaseGate>
        <StockInner />
      </SupabaseGate>
    </AppLayout>
  );
}

function StockInner() {
  const supabase = useSupabase()!;
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [moveProduct, setMoveProduct] = useState<any | null>(null);
  const [moveType, setMoveType] = useState<"in" | "out">("in");
  const [moveQty, setMoveQty] = useState("1");
  const [moveNote, setMoveNote] = useState("");
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [adj, setAdj] = useState<any | null>(null);
  const [adjForm, setAdjForm] = useState({ quantity: "", cost_price: "", unit_price: "", reason: "" });
  const activeFormRef = useRef<HTMLFormElement>(null);
  const { shortcuts } = useWorkspacePreferences();
  const openAdjust = (p: any) => { setAdj(p); setAdjForm({ quantity: String(Number(p.quantity)), cost_price: String(Number(p.cost_price ?? 0)), unit_price: String(Number(p.unit_price)), reason: "" }); };

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const data = await fetchAll(supabase, "products"); const error = null;
      if (error) throw error;
      return data;
    },
  });

  const addProduct = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("products").insert({
        sku: form.sku,
        name: form.name,
        unit: form.unit,
        quantity: Number(form.quantity) || 0,
        reorder_level: Number(form.reorder_level) || 0,
        unit_price: Number(form.unit_price) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setForm(EMPTY_PRODUCT);
      setAddOpen(false);
    },
  });

  const recordMovement = useMutation({
    mutationFn: async () => {
      const qty = Number(moveQty) || 0;
      if (qty <= 0) throw new Error("Quantity must be greater than zero");
      const { error } = await supabase.from("stock_movements").insert({
        product_id: moveProduct.id,
        type: moveType,
        quantity: qty,
        note: moveNote,
      });
      if (error) throw error;
      const newQty = moveType === "in" ? Number(moveProduct.quantity) + qty : Number(moveProduct.quantity) - qty;
      const { error: updError } = await supabase.from("products").update({ quantity: newQty }).eq("id", moveProduct.id);
      if (updError) throw updError;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      setMoveProduct(null);
      setMoveQty("1");
      setMoveNote("");
    },
  });

  const removeProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
  });
  useWorkspaceCommands({ save: () => activeFormRef.current?.requestSubmit(), addRow: () => setAddOpen(true), refresh: () => qc.invalidateQueries({ queryKey: ["products"] }) });

  return (
    <div className="entry-workspace space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">Stock</h1>
          <p className="text-sm text-muted-foreground">Inventory and stock movements</p>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add Product</span><span className="sm:hidden">Add</span></Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New Product</DialogTitle></DialogHeader>
            <form ref={activeFormRef} className="space-y-4" onSubmit={(e) => { e.preventDefault(); addProduct.mutate(); }}>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Unit</Label>
                  <Input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
               <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label>Opening Qty</Label>
                  <Input type="number" step="0.01" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Reorder Level</Label>
                  <Input type="number" step="0.01" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input type="number" step="0.01" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
                </div>
              </div>
              <Button type="submit" title={`Save · ${shortcuts.save}`} className="w-full" disabled={addProduct.isPending}>
                {addProduct.isPending ? "Saving…" : "Save Product"}
              </Button>
              {addProduct.isError && <p className="text-sm text-destructive">{String(addProduct.error)}</p>}
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>SKU</TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">In Stock</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-right">Stock Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-36" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No products yet — add your first item.</TableCell></TableRow>
              ) : (
                products.map((p) => {
                  const low = Number(p.quantity) <= Number(p.reorder_level);
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.sku}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{Number(p.quantity)} {p.unit}</TableCell>
                      <TableCell className="text-right">{money(p.unit_price)}</TableCell>
                      <TableCell className="text-right font-medium">{money(Number(p.quantity) * Number(p.unit_price))}</TableCell>
                      <TableCell>
                        {low ? (
                          <Badge variant="secondary" className="bg-destructive/10 text-destructive">Low stock</Badge>
                        ) : (
                          <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">In stock</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" title="Stock in" onClick={() => { setMoveProduct(p); setMoveType("in"); }}>
                            <ArrowDownToLine className="h-4 w-4 text-emerald-600" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Stock out" onClick={() => { setMoveProduct(p); setMoveType("out"); }}>
                            <ArrowUpFromLine className="h-4 w-4 text-amber-600" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Adjust stock / price" onClick={() => openAdjust(p)}>
                            <SlidersHorizontal className="h-4 w-4 text-primary" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${p.name}?`)) removeProduct.mutate(p.id); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!adj} onOpenChange={(o) => !o && setAdj(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adjust — {adj?.name}</DialogTitle></DialogHeader>
          <form ref={activeFormRef} className="space-y-4" onSubmit={async (e) => {
            e.preventDefault();
            try {
              await adjustStock(supabase, adj, { quantity: Number(adjForm.quantity) || 0, cost_price: Number(adjForm.cost_price) || 0, unit_price: Number(adjForm.unit_price) || 0, reason: adjForm.reason });
              toast.success("Stock adjusted"); qc.invalidateQueries(); setAdj(null);
            } catch (err: any) { toast.error(err.message ?? "Could not adjust"); }
          }}>
            <p className="text-sm text-muted-foreground">Current stock: {Number(adj?.quantity ?? 0)} {adj?.unit}. Enter the correct counted quantity and prices.</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2"><Label>New qty</Label><Input type="number" step="0.01" required value={adjForm.quantity} onChange={(e) => setAdjForm({ ...adjForm, quantity: e.target.value })} /></div>
              <div className="space-y-2"><Label>Cost price</Label><Input type="number" step="0.01" value={adjForm.cost_price} onChange={(e) => setAdjForm({ ...adjForm, cost_price: e.target.value })} /></div>
              <div className="space-y-2"><Label>Sale price</Label><Input type="number" step="0.01" value={adjForm.unit_price} onChange={(e) => setAdjForm({ ...adjForm, unit_price: e.target.value })} /></div>
            </div>
            {adj && Number(adjForm.quantity) !== Number(adj.quantity) && (
              <p className="text-sm font-medium">Change: {Number(adjForm.quantity) - Number(adj.quantity) > 0 ? "+" : ""}{(Number(adjForm.quantity) - Number(adj.quantity)).toFixed(2)} {adj.unit}</p>
            )}
            <div className="space-y-2"><Label>Reason</Label><Input placeholder="Stock count, damage, expiry, restock…" value={adjForm.reason} onChange={(e) => setAdjForm({ ...adjForm, reason: e.target.value })} /></div>
            <Button type="submit" title={`Save · ${shortcuts.save}`} className="w-full">Save Adjustment</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!moveProduct} onOpenChange={(o) => !o && setMoveProduct(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{moveType === "in" ? "Stock In" : "Stock Out"} — {moveProduct?.name}</DialogTitle>
          </DialogHeader>
          <form ref={activeFormRef} className="space-y-4" onSubmit={(e) => { e.preventDefault(); recordMovement.mutate(); }}>
            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input type="number" step="0.01" min="0.01" required value={moveQty} onChange={(e) => setMoveQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Note</Label>
              <Input placeholder="Purchase, sale, damage…" value={moveNote} onChange={(e) => setMoveNote(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={recordMovement.isPending}>
              {recordMovement.isPending ? "Saving…" : "Record Movement"}
            </Button>
            {recordMovement.isError && <p className="text-sm text-destructive">{String(recordMovement.error)}</p>}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
