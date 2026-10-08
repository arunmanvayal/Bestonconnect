import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/reports")({
  beforeLoad: () => { throw redirect({ to: "/admin/reports", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Reports moved — Bestonconnect" }, { name: "description", content: "Reports is now in Bestonconnect Admin." }, { property: "og:title", content: "Reports moved — Bestonconnect" }, { property: "og:description", content: "Open Reports in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
