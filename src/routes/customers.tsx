import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/customers")({
  beforeLoad: () => { throw redirect({ to: "/admin/customers", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Customers moved — Bestonconnect" }, { name: "description", content: "Customers is now in Bestonconnect Admin." }, { property: "og:title", content: "Customers moved — Bestonconnect" }, { property: "og:description", content: "Open Customers in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
