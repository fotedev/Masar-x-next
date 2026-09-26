// Spec 022 — shared render helpers. Every hook/component under test needs a
// QueryClientProvider (production code uses @tanstack/react-query everywhere);
// a fresh client per render prevents cross-test cache bleed, and retries are
// disabled so failures surface immediately instead of after 3 backoffs.
import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, renderHook, type RenderHookResult, type RenderResult } from '@testing-library/react';

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function makeWrapper(): [({ children }: { children: ReactNode }) => ReactElement, QueryClient] {
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return [wrapper, queryClient];
}

export function renderWithProviders(ui: ReactElement): RenderResult & { queryClient: QueryClient } {
  const [wrapper, queryClient] = makeWrapper();
  const result = render(ui, { wrapper });
  return { ...result, queryClient };
}

export function renderHookWithProviders<TResult, TProps>(
  callback: (props: TProps) => TResult,
): RenderHookResult<TResult, TProps> & { queryClient: QueryClient } {
  const [wrapper, queryClient] = makeWrapper();
  const result = renderHook(callback, { wrapper });
  return { ...result, queryClient };
}
