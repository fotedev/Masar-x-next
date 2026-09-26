/**
 * useAcademicProfile (spec 019 C4): reads the signed-in user's
 * level/semester/department_id from `profiles` and reloads when any
 * screen saves a new academic path (subscribeAcademic) — so the
 * Subjects tab's filter follows a Profile edit without a restart.
 */
import { useCallback, useEffect, useState } from "react";

import {
  fetchAcademicProfile,
  subscribeAcademic,
  type AcademicProfile,
} from "../lib/academic";
import { getSupabaseClient } from "../lib/supabase";

export interface AcademicProfileState {
  profile: AcademicProfile | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useAcademicProfile(userId: string | undefined): AcademicProfileState {
  const [profile, setProfile] = useState<AcademicProfile | null>(null);
  const [loading, setLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const data = await fetchAcademicProfile(getSupabaseClient(), userId);
        if (cancelled) return;
        setProfile(data);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        // Offline / transient failure: subjects filtering falls back to
        // the defaults; nothing blocks the UI.
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, reloadToken]);

  useEffect(
    () => subscribeAcademic(() => setReloadToken((n) => n + 1)),
    [],
  );

  return { profile, loading, error, reload };
}
