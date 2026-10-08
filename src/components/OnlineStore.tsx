import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, ShoppingCart, UserRound, Zap, CircuitBoard, Wrench, Package, Minus, Plus, CheckCircle2, ShieldCheck, Menu, Store, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { useSupabase } from "@/lib/supabase";
import { canAddToCart, cartTotal, checkoutSchema, fetchShopProducts, filterShopProducts, SHOP_CATEGORIES, type CartLine, type ShopProduct } from "@/lib/online-shop";
import { money } from "@/components/SupabaseGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import cover from "@/assets/shop-essentials.jpg";

const categoryIcons = [Zap, CircuitBoard, Wrench];
export function OnlineStore() {
  const sb = useSupabase();
  const { data: products = [], isLoading, error, refetch } = useQuery({ queryKey: ["online-catalog"], queryFn: () => { if (!sb) throw new Error("Connecting…"); return fetchShopProducts(sb); }, enabled: !!sb, retry: false });
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sort, setSort] = useState("name");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selected, setSelected] = useState<ShopProduct | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<{ order_no: string; total: number } | null>(null);
  const requestKey = useRef<string | null>(null);
  const grid = useRef<HTMLElement>(null);
  const visible = filterShopProducts(products, search, category).sort((a,b) => sort === "low" ? a.price-b.price : sort === "high" ? b.price-a.price : a.name.localeCompare(b.name));
  const add = (p: ShopProduct) => {
    if (!canAddToCart(cart,p)) { toast.error(cart.length && cart[0]?.product.company_id !== p.company_id ? "Place a separate order for each store" : "No more stock available"); return; }
    setCart(prev => prev.some(l => l.product.id === p.id) ? prev.map(l => l.product.id === p.id ? { ...l, quantity: l.quantity+1 } : l) : [...prev, { product: p, quantity: 1 }]);
    requestKey.current = null;
    toast.success("Added to cart");
  };
  const changeQty = (id: string, delta: number) => { setCart(prev => prev.map(l => l.product.id === id ? { ...l, quantity: Math.min(Number(l.product.quantity), l.quantity + delta) } : l).filter(l => l.quantity > 0)); requestKey.current = null; };
  const order = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sb || !cart[0]) return;
    const form = new FormData(event.currentTarget);
    try {
      const customer = checkoutSchema.parse(Object.fromEntries(form));
      setBusy(true);
      requestKey.current ??= crypto.randomUUID();
      const { data, error: e } = await sb.rpc("place_online_order", { _company: cart[0].product.company_id, _customer: customer, _items: cart.map(l => ({ product_id: l.product.id, quantity: l.quantity })), _request_key: requestKey.current });
      if (e) throw new Error("Your order was not confirmed. Stock may have changed; please refresh and try again.");
      setReceipt(data); setCart([]); setCheckout(false); requestKey.current = null; void refetch();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Could not place order"); } finally { setBusy(false); }
  };
  return <div className="storefront pb-24 sm:pb-8">
    <header className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
        <Link to="/" className="flex min-w-0 items-center gap-2"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-shop-brand font-display text-xl font-bold text-shop-brand-foreground">BC</span><span className="font-display text-xl font-bold sm:text-2xl">Beston<span className="text-shop-brand">connect</span></span></Link>
        <div className="flex gap-2"><Button variant="ghost" size="icon" aria-label={`Open cart, ${cart.reduce((s,l)=>s+l.quantity,0)} items`} onClick={() => { setCartOpen(true); setReceipt(null); }} className="relative"><ShoppingCart />{cart.length > 0 && <span className="absolute right-0 top-0 grid h-4 w-4 place-items-center rounded-full bg-primary text-[10px] text-primary-foreground">{cart.reduce((s,l)=>s+l.quantity,0)}</span>}</Button><Button asChild variant="ghost" size="icon"><Link to="/admin" aria-label="Admin dashboard"><UserRound /></Link></Button></div>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 sm:px-8">
      <div className="flex gap-3 py-5"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground"/><Input aria-label="Search products" placeholder="Search electricals, electronics, hardware…" className="h-12 bg-card pl-10" value={search} onChange={e => setSearch(e.target.value)} /></div><label className="flex items-center gap-2 rounded-md border border-border bg-card px-3"><SlidersHorizontal className="h-4 w-4"/><select aria-label="Sort products" className="max-w-24 bg-transparent text-sm" value={sort} onChange={e=>setSort(e.target.value)}><option value="name">A–Z</option><option value="low">Price ↑</option><option value="high">Price ↓</option></select></label></div>
      <section className="shop-cover rounded-lg">
        <img src={cover} alt="Electrical cable, LED bulb, switches, drill and hardware supplies" width={1536} height={768}/>
        <div className="shop-cover-copy"><p className="mb-3 text-xs font-bold uppercase text-shop-brand">Your project starts here</p><h1 className="text-3xl font-bold leading-tight sm:text-4xl">Electricals,<br/>electronics<br/>& hardware.</h1><p className="mt-3 max-w-64 text-sm text-muted-foreground">Everyday essentials. All in one place.</p><Button className="mt-5" onClick={() => grid.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>Shop products <ArrowRight className="h-4 w-4"/></Button></div>
      </section>
      <section className="py-7"><div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-bold">Shop by category</h2><Button variant="link" onClick={() => setCategory("All")}>See all <ArrowRight className="h-4 w-4"/></Button></div><div className="grid grid-cols-3 gap-3 sm:gap-5">{SHOP_CATEGORIES.map((c,i)=>{const Icon=categoryIcons[i] ?? Package; return <Button key={c} variant="outline" onClick={()=>{setCategory(c);grid.current?.scrollIntoView({behavior:"smooth"});}} className={`h-auto flex-col gap-3 bg-card px-2 py-5 ${category === c ? "border-shop-brand text-shop-brand" : ""}`}><span className="grid h-14 w-14 place-items-center rounded-full bg-muted"><Icon className="h-7 w-7"/></span><span className="text-xs sm:text-sm">{c}</span><span className="text-[11px] font-normal text-muted-foreground">{products.filter(p=>p.category===c).length} products</span></Button>;})}</div></section>
      <section ref={grid} className="scroll-mt-5 pb-8"><div className="mb-4 flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{category === "All" ? "Shop essentials" : category}</h2><p className="mt-1 text-xs text-muted-foreground">{visible.length} products</p></div>{category !== "All" && <Button variant="link" onClick={()=>setCategory("All")}>All products</Button>}</div>
        {isLoading || !sb ? <p className="py-10 text-center text-muted-foreground">Loading products…</p> : error ? <div className="border-y border-border py-10 text-center"><Package className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/><h3 className="font-semibold">Our online shelves are getting ready</h3><p className="mt-2 text-sm text-muted-foreground">Products will appear here when the store opens.</p><Button variant="outline" className="mt-4" onClick={()=>void refetch()}>Refresh</Button></div> : !visible.length ? <div className="border-y border-border py-12 text-center"><Package className="mx-auto mb-3 h-9 w-9 text-muted-foreground"/><p className="font-semibold">{search ? "No matching products" : "No products listed yet"}</p>{search && <Button variant="link" onClick={()=>{setSearch("");setCategory("All");}}>Clear filters</Button>}</div> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">{visible.map(p=><article key={p.id} className="overflow-hidden rounded-lg border border-border bg-card"><Button variant="ghost" className="relative h-auto w-full rounded-none p-0" aria-label={`View ${p.name}`} onClick={()=>setSelected(p)}>{p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" width={320} height={320} className="aspect-square w-full object-contain p-3"/> : <div className="grid aspect-square w-full place-items-center bg-muted"><Package className="h-14 w-14 text-muted-foreground"/></div>}{Number(p.mrp)>Number(p.price) && <span className="absolute left-2 top-2 rounded bg-shop-brand px-2 py-1 text-[10px] text-shop-brand-foreground">{money(p.mrp-p.price)} OFF</span>}</Button><div className="p-3"><p className="text-[10px] uppercase text-muted-foreground">{p.category}</p><h3 className="mt-1 line-clamp-2 min-h-10 text-sm font-semibold">{p.name}</h3><div className="mt-2 flex flex-wrap items-center gap-2"><span className="font-bold text-shop-brand">{money(p.price)}</span>{Number(p.mrp)>Number(p.price) && <del className="text-xs text-muted-foreground">{money(p.mrp)}</del>}</div><Button size="sm" className="mt-3 w-full" disabled={Number(p.quantity)<1} onClick={()=>add(p)}><ShoppingCart className="h-4 w-4"/>{Number(p.quantity)<1 ? "Out of stock" : "Add to cart"}</Button></div></article>)}</div>}
      </section>
      <div className="flex flex-wrap justify-between gap-4 border-t border-border py-6 text-xs text-muted-foreground"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4"/>Order directly from the store</span><span>Bestonconnect · Electricals, electronics & hardware</span><Link to="/admin" className="font-semibold text-shop-brand">Admin dashboard</Link></div>
    </main>
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-3 border-t border-border bg-card py-2 sm:hidden"><Button asChild variant="ghost" className="h-12 flex-col gap-1 text-xs"><Link to="/admin"><Menu className="h-5 w-5"/>Admin</Link></Button><Button variant="ghost" className="h-12 flex-col gap-1 text-xs text-shop-brand" onClick={()=>{setCategory("All");setSearch("");window.scrollTo({top:0,behavior:"smooth"});}}><Store className="h-5 w-5"/>Shop</Button><Button variant="ghost" className="h-12 flex-col gap-1 text-xs" onClick={()=>{setCartOpen(true);setReceipt(null);}}><ShoppingCart className="h-5 w-5"/>Cart ({cart.reduce((s,l)=>s+l.quantity,0)})</Button></nav>
    <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="max-h-[90vh] overflow-auto"><DialogTitle>{selected?.name}</DialogTitle><DialogDescription>{selected?.category} · {selected?.sku}</DialogDescription>{selected && <>{selected.image_url && <img src={selected.image_url} alt={selected.name} className="mx-auto aspect-square max-h-64 object-contain"/>}<p className="whitespace-pre-line text-sm">{selected.description || selected.name}</p><p className="text-xl font-bold">{money(selected.price)}</p><p className="text-xs text-muted-foreground">{Number(selected.quantity)>0 ? "In stock" : "Out of stock"} · {selected.unit}</p><Button disabled={Number(selected.quantity)<1} onClick={()=>add(selected)}>Add to cart <ShoppingCart className="h-4 w-4"/></Button></>}</DialogContent></Dialog>
    <Dialog open={cartOpen} onOpenChange={setCartOpen}><DialogContent className="max-h-[90vh] overflow-auto"><DialogTitle>{receipt ? "Order received" : checkout ? "Your details" : "Your cart"}</DialogTitle><DialogDescription>{receipt ? "The store will contact you to confirm your order." : "Payment and delivery will be confirmed by the store."}</DialogDescription>{receipt ? <div className="space-y-3 py-4"><CheckCircle2 className="h-10 w-10 text-primary"/><p className="break-all font-semibold">{receipt.order_no}</p><p className="text-xl font-bold">{money(receipt.total)}</p></div> : !cart.length ? <p className="py-8 text-center text-muted-foreground">Your cart is empty.</p> : checkout ? <form onSubmit={order} className="space-y-3"><label className="block text-sm">Name<Input name="name" required minLength={2} maxLength={100} autoComplete="name"/></label><label className="block text-sm">Phone<Input name="phone" type="tel" required maxLength={20} autoComplete="tel"/></label><label className="block text-sm">Delivery address<textarea name="address" required minLength={5} maxLength={1000} autoComplete="street-address" className="mt-1 min-h-20 w-full rounded-md border border-input bg-background p-3"/></label><label className="block text-sm">Notes (optional)<Input name="notes" maxLength={1000}/></label><p className="flex justify-between font-bold"><span>Total</span>{money(cartTotal(cart))}</p><div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>setCheckout(false)}>Back</Button><Button type="submit" disabled={busy} className="flex-1">{busy ? "Placing order…" : "Place order"}</Button></div></form> : <><div className="divide-y divide-border">{cart.map(l=><div key={l.product.id} className="flex gap-3 py-4"><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{l.product.name}</p><p className="mt-1 text-sm text-muted-foreground">{money(l.product.price*l.quantity)}</p></div><div className="flex items-center gap-2"><Button variant="outline" size="icon" aria-label={`Remove one ${l.product.name}`} onClick={()=>changeQty(l.product.id,-1)}><Minus/></Button><span>{l.quantity}</span><Button variant="outline" size="icon" aria-label={`Add one ${l.product.name}`} disabled={l.quantity>=Number(l.product.quantity)} onClick={()=>changeQty(l.product.id,1)}><Plus/></Button></div></div>)}</div><p className="flex justify-between text-lg font-bold"><span>Total</span>{money(cartTotal(cart))}</p><Button onClick={()=>setCheckout(true)}>Continue to order <ArrowRight className="h-4 w-4"/></Button></>}</DialogContent></Dialog>
  </div>;
}