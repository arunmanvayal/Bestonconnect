import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/payments")({
  beforeLoad: () => { throw redirect({ to: "/admin/payments", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Payments moved — Bestonconnect" }, { name: "description", content: "Payments is now in Bestonconnect Admin." }, { property: "og:title", content: "Payments moved — Bestonconnect" }, { property: "og:description", content: "Open Payments in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
