import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/tools")({
  beforeLoad: () => { throw redirect({ to: "/admin/tools", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Tools moved — Bestonconnect" }, { name: "description", content: "Tools is now in Bestonconnect Admin." }, { property: "og:title", content: "Tools moved — Bestonconnect" }, { property: "og:description", content: "Open Tools in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
