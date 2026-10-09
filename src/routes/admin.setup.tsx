import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { AppLayout } from "@/components/AppLayout";
import { SETUP_SQL as BASE_SQL, INVOICE_SQL, COMPANY_SQL, USERNAME_SQL, IMPORT_SQL } from "@/lib/schema-sql";
import { INVOICE_EDIT_SQL } from "@/lib/invoice-edit-sql";
import { ONLINE_SHOP_SQL } from "@/lib/online-shop-sql";
import { INVOICE_ENTRY_SQL } from "@/lib/invoice-entry-sql";
import { STOCK_MAINTENANCE_SQL } from "@/lib/stock-maintenance-sql";
import { MASTERS_SQL } from "@/lib/masters-sql";
const SETUP_SQL = BASE_SQL + INVOICE_SQL + COMPANY_SQL + USERNAME_SQL + IMPORT_SQL + INVOICE_ENTRY_SQL + INVOICE_EDIT_SQL + ONLINE_SHOP_SQL + STOCK_MAINTENANCE_SQL + MASTERS_SQL;
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/admin/setup")({
  head: () => ({
    meta: [
      { title: "Database Setup — BusinessDesk" },
      { name: "description", content: "One-time database setup script for your Supabase project." },
      { property: "og:title", content: "Database Setup — BusinessDesk" },
      { property: "og:description", content: "One-time database setup script for your Supabase project." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SetupPage,
});

function SetupPage() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(SETUP_SQL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Database Setup</h1>
          <p className="text-sm text-muted-foreground">One-time step to create the tables in your Supabase project</p>
        </div>

        <div className="space-y-3 border-y border-border py-5">
          <h2 className="font-semibold">Product and Masters update</h2>
          <p className="text-sm text-muted-foreground">Run this update after the existing setup to enable the full Product form and linked Masters options.</p>
          <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(MASTERS_SQL); setCopied(true); setTimeout(() => setCopied(false), 2000); }}><Copy className="h-4 w-4"/>Copy Product and Masters update</Button>
        </div>
        <div className="space-y-3 border-y border-border py-5">
          <h2 className="font-semibold">Online shop setup</h2>
          <p className="text-sm text-muted-foreground">Run the latest script below to enable online products and orders. In your connected database's Storage area, create a public bucket named <strong>online-products</strong>, with a 5 MB file limit and JPG, PNG and WebP images allowed. Product photos are public; orders and business records stay private.</p>
          <Button variant="outline" onClick={async () => { await navigator.clipboard.writeText(ONLINE_SHOP_SQL); setCopied(true); setTimeout(() => setCopied(false), 2000); }}><Copy className="h-4 w-4" />Copy online shop update only</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">How it works</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Open your Supabase dashboard and go to <strong className="text-foreground">SQL Editor → New query</strong>.</p>
            <p>2. Copy the script below and paste it into the editor.</p>
            <p>3. Click <strong className="text-foreground">Run</strong>. That's it — come back here and everything will work.</p>
          </CardContent>
        </Card>

        <Card>
           <CardHeader className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <CardTitle className="text-base">Setup script</CardTitle>
            <Button variant="outline" size="sm" onClick={copy}>
              {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? "Copied" : "Copy script"}
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[480px] overflow-auto rounded-md bg-muted p-4 text-xs leading-relaxed text-foreground">
              {SETUP_SQL}
            </pre>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
