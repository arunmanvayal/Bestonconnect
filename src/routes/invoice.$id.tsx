import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/invoice/$id")({
  validateSearch: (s: Record<string, unknown>) => ({ print: s["print"] === 1 || s["print"] === "1" ? 1 : undefined }),
  beforeLoad: ({ params, search }) => { throw redirect({ to: "/admin/invoice/$id", params, search, statusCode: 301, replace: true }); },
  head: () => ({ meta: [{ title: "Invoice moved — Bestonconnect" }, { name: "description", content: "Invoice printing is now in Bestonconnect Admin." }, { property: "og:title", content: "Invoice moved — Bestonconnect" }, { property: "og:description", content: "Open invoice printing in Bestonconnect Admin." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex" }] }),
});
