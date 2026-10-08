import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/setup")({
  beforeLoad: () => { throw redirect({ to: "/admin/setup", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Setup moved — Bestonconnect" }, { name: "description", content: "Setup is now in Bestonconnect Admin." }, { property: "og:title", content: "Setup moved — Bestonconnect" }, { property: "og:description", content: "Open Setup in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
