import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/ledger")({
  beforeLoad: () => { throw redirect({ to: "/admin/ledger", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Ledger moved — Bestonconnect" }, { name: "description", content: "Ledger is now in Bestonconnect Admin." }, { property: "og:title", content: "Ledger moved — Bestonconnect" }, { property: "og:description", content: "Open Ledger in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
