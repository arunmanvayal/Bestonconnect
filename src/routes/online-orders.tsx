import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/online-orders")({
  beforeLoad: () => { throw redirect({ to: "/admin/online-orders", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Online Orders moved — Bestonconnect" }, { name: "description", content: "Online Orders is now in Bestonconnect Admin." }, { property: "og:title", content: "Online Orders moved — Bestonconnect" }, { property: "og:description", content: "Open Online Orders in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
