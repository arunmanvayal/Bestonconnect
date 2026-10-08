import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { SupabaseGate } from "@/components/SupabaseGate";
import { InvoiceForm } from "@/components/InvoiceForm";

export const Route = createFileRoute("/admin/purchase")({
  head: () => ({
    meta: [
      { title: "Purchase Invoice — BusinessDesk" },
      { name: "description", content: "Record supplier purchases that add stock and post to the ledger automatically." },
      { property: "og:title", content: "Purchase Invoice — BusinessDesk" },
      { property: "og:description", content: "Record supplier purchases that add stock and post to the ledger automatically." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <AppLayout>
      <SupabaseGate>
        <InvoiceForm kind="purchase" />
      </SupabaseGate>
    </AppLayout>
  ),
});
