import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/online-products")({
  beforeLoad: () => { throw redirect({ to: "/admin/online-products", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Online Products moved — Bestonconnect" }, { name: "description", content: "Online Products is now in Bestonconnect Admin." }, { property: "og:title", content: "Online Products moved — Bestonconnect" }, { property: "og:description", content: "Open Online Products in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
