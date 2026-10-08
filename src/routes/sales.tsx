import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/sales")({
  beforeLoad: () => { throw redirect({ to: "/admin/sales", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Sales moved — Bestonconnect" }, { name: "description", content: "Sales is now in Bestonconnect Admin." }, { property: "og:title", content: "Sales moved — Bestonconnect" }, { property: "og:description", content: "Open Sales in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
