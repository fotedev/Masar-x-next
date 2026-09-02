/**
 * Generic stale-while-network data hook (the mobile stand-in for the
 * web's TanStack Query usage, per the "keep deps lean" decision):
 *
 *   1. Instantly render the LocalReadCache copy when present (FR-011).
 *   2. Refetch over the network; on success replace data + refresh cache.
 *   3. When offline, keep cached content readable and expose
 *      `offline: true` so screens show the offline banner instead of an
 *      error (spec FR-011 "previously loaded content remains readable").
 */
import { useCallback, useEffect, useRef, useState } from "react";

import type { SupabaseClient } from "masarx-shared/supabase";

import { cacheGet, cacheSet } from "../read-cache";
import { useNetworkStatus } from "./useNetworkStatus";

export interface SupabaseQueryOptions<T> {
  cacheKey: string;
  fetcher: (supabase: SupabaseClient) => Promise<T>;
  ttlHours?: number;
  enabled?: boolean;
}

export interface SupabaseQueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  offline: boolean;
  fromCache: boolean;
  cachedAt: string | null;
  refetch: () => void;
}

export function useSupabaseQuery<T>(options: SupabaseQueryOptions<T>): SupabaseQueryResult<T> {
  const { cacheKey, fetcher, ttlHours, enabled = true } = options;
  const { online } = useNetworkStatus();

  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [cachedAt, setCachedAt] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const run = async () => {
      setError(null);
      const cached = await cacheGet<T>(cacheKey);
      if (cancelled) return;
      if (cached) {
        setData(cached.payload);
        setFromCache(true);
        setCachedAt(cached.savedAt);
        setLoading(false);
      }

      if (!online) {
        // FR-011: cached content stays readable; nothing to fetch now.
        setLoading((prev) => (cached ? false : prev));
        return;
      }

      if (!cached) {
        setLoading(true);
      }

      try {
        const { getSupabaseClient } = await import("../lib/supabase");
        const fresh = await fetcherRef.current(getSupabaseClient());
        if (cancelled) return;
        setData(fresh);
        setFromCache(false);
        setCachedAt(null);
        await cacheSet(cacheKey, fresh, ttlHours);
      } catch (err) {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, online, reloadToken, ttlHours]);

  const refetch = useCallback(() => setReloadToken((n) => n + 1), []);

  return { data, loading, error, offline: !online, fromCache, cachedAt, refetch };
}