import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate } from "@/components/SupabaseGate";
import { InvoiceForm } from "@/components/InvoiceForm";

export const Route = createFileRoute("/sales")({
  head: () => ({
    meta: [
      { title: "Sales Invoice — BusinessDesk" },
      { name: "description", content: "Create GST retail invoices that update stock, customers and the ledger automatically." },
      { property: "og:title", content: "Sales Invoice — BusinessDesk" },
      { property: "og:description", content: "Create GST retail invoices that update stock, customers and the ledger automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <SupabaseGate>
        <InvoiceForm kind="sale" />
      </SupabaseGate>
    </AppLayout>
  ),
});
