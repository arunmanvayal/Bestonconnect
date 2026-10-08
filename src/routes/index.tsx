import { createFileRoute } from "@tanstack/react-router";
import { OnlineStore } from "@/components/OnlineStore";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Bestonconnect — Electricals, Electronics & Hardware" },
    { name: "description", content: "Shop electrical supplies, electronics and hardware from Bestonconnect. Browse products and place an order directly with the store." },
    { property: "og:title", content: "Bestonconnect — Electricals, Electronics & Hardware" },
    { property: "og:description", content: "Browse electrical supplies, electronics and hardware and order directly from the store." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: OnlineStore,
});