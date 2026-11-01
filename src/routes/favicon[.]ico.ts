import { createFileRoute } from "@tanstack/react-router";
import { brandIconResponse } from "./api/public/brand-icon";

/** Crawlers that ignore <link rel="icon"> request /favicon.ico; serve the uploaded brand logo there too. */
export const Route = createFileRoute("/favicon.ico")({
  server: { handlers: { GET: ({ request }) => brandIconResponse(request) } },
});
