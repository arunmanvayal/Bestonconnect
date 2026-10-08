import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/stock")({
  beforeLoad: () => { throw redirect({ to: "/admin/stock", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Stock moved — Bestonconnect" }, { name: "description", content: "Stock is now in Bestonconnect Admin." }, { property: "og:title", content: "Stock moved — Bestonconnect" }, { property: "og:description", content: "Open Stock in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
