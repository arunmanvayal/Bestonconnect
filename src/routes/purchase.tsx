import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/purchase")({
  beforeLoad: () => { throw redirect({ to: "/admin/purchase", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Purchase moved — Bestonconnect" }, { name: "description", content: "Purchase is now in Bestonconnect Admin." }, { property: "og:title", content: "Purchase moved — Bestonconnect" }, { property: "og:description", content: "Open Purchase in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
