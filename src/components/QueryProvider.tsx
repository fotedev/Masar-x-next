"use client";

import { type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Keep query data "fresh" for 5 minutes — matches the
            // standardized staleTime used by individual hooks.
            staleTime: 5 * 60 * 1000,
            // Keep inactive query data in memory for 30 minutes so
            // remounting a recently-viewed page doesn't refetch.
            gcTime: 30 * 60 * 1000,
            // Refetch on tab focus / reconnect (explicit even though
            // these are the React Query defaults — documents intent
            // and makes future overrides easy to find).
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            // Fail fast on errors (default is 3 retries). For Supabase
            // calls, a retry storm just amplifies transient errors.
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
