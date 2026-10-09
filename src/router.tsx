import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { ENTRY_QUERY_DEFAULTS } from "./lib/session-refresh";

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        refetchOnWindowFocus: false,
        staleTime: 5000,
      },
    },
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: ENTRY_QUERY_DEFAULTS } });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
