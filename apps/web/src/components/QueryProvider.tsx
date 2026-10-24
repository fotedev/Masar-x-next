"use client";

import { type ReactNode } from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Module-level singleton so non-provider code (AuthContext sign-out) can
// purge role-scoped cache data on auth transitions (audit M45 — appeals/
// enrollments rows must never survive an account switch on the same tab).
export const queryClient = new QueryClient({
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
});

export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
