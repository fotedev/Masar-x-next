// Spec 022 Stage 1 — infrastructure smoke. Proves the React 19 + RTL 16 +
// jsdom + react-query wire-up BEFORE any real hook/component test depends on
// it (the React-19 act()/lifecycle guidance from the coverage-campaign review).
import { describe, expect, it, vi } from 'vitest';
import { useQuery } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import { createSupabaseMock, orClauses } from '../mocks/supabase';
import { renderHookWithProviders, renderWithProviders } from '../utils/render';

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock().supabase }));

function Greeting({ name }: { name: string }) {
  return <p data-testid="greeting">Hello {name}</p>;
}

function useFakeQuery() {
  return useQuery({
    queryKey: ['smoke'],
    queryFn: async () => {
      // Realistic PostgREST chain shape — proves the thenable builder awaits.
      const { supabase } = await import('@/lib/supabase');
      const { data } = await (supabase as never as ReturnType<typeof createSupabaseMock>['supabase'])
        .from('subjects')
        .select('id')
        .or('is_academic.eq.true,is_academic.is.null');
      return data;
    },
  });
}

describe('test infrastructure smoke (spec 022 Stage 1)', () => {
  it('renders a component with RTL + jest-dom under jsdom', () => {
    renderWithProviders(<Greeting name="Masar" />);
    expect(screen.getByTestId('greeting')).toHaveTextContent('Hello Masar');
  });

  it('runs a react-query hook through renderHook under React 19', async () => {
    const { result } = renderHookWithProviders(() => useFakeQuery());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it('records PostgREST chains via the supabase mock', async () => {
    const chain = createSupabaseMock();
    const builder = chain.supabase.from('subjects') as { select: (s: string) => unknown } & Record<string, (...a: unknown[]) => unknown>;
    await builder.select('id').order('name', { ascending: true }).or('level.eq.1,level.is.null');
    expect(chain.calls.map((c) => c.method)).toEqual(['from', 'select', 'order', 'or']);
    expect(orClauses(chain)).toContain('level.eq.1,level.is.null');
  });

  it('supports act() state updates without React 19 warnings', async () => {
    const { result } = renderHookWithProviders(() => useFakeQuery());
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(async () => {
      await result.current.refetch();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});
