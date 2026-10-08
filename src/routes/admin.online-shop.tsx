import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { OnlineStore } from "@/components/OnlineStore";

export const Route = createFileRoute("/admin/online-shop")({
  head: () => ({ meta: [
    { title: "Online Shop — Bestonconnect Admin" },
    { name: "description", content: "View your online storefront from the Bestonconnect admin workspace." },
    { property: "og:title", content: "Online Shop — Bestonconnect Admin" },
    { property: "og:description", content: "Review your online shop and published products." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: () => <AppLayout><OnlineStore /></AppLayout>,
});