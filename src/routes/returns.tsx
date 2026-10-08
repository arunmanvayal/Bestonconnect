import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/returns")({
  beforeLoad: () => { throw redirect({ to: "/admin/returns", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Returns moved — Bestonconnect" }, { name: "description", content: "Returns is now in Bestonconnect Admin." }, { property: "og:title", content: "Returns moved — Bestonconnect" }, { property: "og:description", content: "Open Returns in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
