import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/profile")({
  beforeLoad: () => { throw redirect({ to: "/admin/profile", statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Profile moved — Bestonconnect" }, { name: "description", content: "Profile is now in Bestonconnect Admin." }, { property: "og:title", content: "Profile moved — Bestonconnect" }, { property: "og:description", content: "Open Profile in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
