import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/accounts")({
  beforeLoad: () => { throw redirect({ to: "/admin/accounts", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Accounts moved — Bestonconnect" }, { name: "description", content: "Accounts is now in Bestonconnect Admin." }, { property: "og:title", content: "Accounts moved — Bestonconnect" }, { property: "og:description", content: "Open Accounts in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
