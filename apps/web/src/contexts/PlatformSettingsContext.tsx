"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, Component, ErrorInfo } from "react";
import { supabase } from "@/lib/supabase";
import { queryCache, cacheKeys, cacheTTL } from "@/lib/queryCache";
import { RealtimePostgresChangesPayload, RealtimeChannel } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";

/**
 * Spec 013 — platform DEFAULT semester only.
 *
 * This context no longer decides what signed-in students see: their own
 * profiles.semester does (see useEffectiveSemester). defaultSemester feeds
 * anonymous visitors, new signups and the admin default. Writes go through
 * the admin_migrate_student_semesters RPC (admin dashboard); this context is
 * read-only and updates via Supabase Realtime or the local
 * `defaultSemesterChanged` window event (optimistic admin update).
 */

const DEFAULT_SEMESTER_EVENT = "defaultSemesterChanged";

interface PlatformSettings {
  default_semester?: number;
}

interface PlatformSettingsValue {
  semester: number;
}

interface PlatformSettingsRow {
  key: string;
  value: PlatformSettingsValue;
  updated_at: string;
}

interface PlatformSettingsContextType {
  loading: boolean;
  settings: PlatformSettings;
  defaultSemester: number;
  fetchSettings: (skipCache?: boolean) => Promise<void>;
  error: Error | null;
}

const PlatformSettingsContext = createContext<PlatformSettingsContextType | undefined>(undefined);

// Error Boundary for PlatformSettingsProvider
class PlatformSettingsErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error("PlatformSettingsProvider Error Boundary caught an error", error, errorInfo as unknown as Record<string, unknown>);
  }

  render() {
    if (this.state.hasError) {
      // Fallback for when the provider fails
      return <PlatformSettingsFallback children={this.props.children} />;
    }

    return this.props.children;
  }
}

// Fallback component that provides basic functionality if the main provider fails
function PlatformSettingsFallback({ children }: { children: ReactNode }) {
  const getInitialSemester = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("defaultSemester");
      return saved ? Number(saved) : 1;
    }
    return 1;
  };

  const [settings] = useState<PlatformSettings>({ default_semester: getInitialSemester() });

  const value = useMemo(() => ({
    loading: false,
    settings,
    defaultSemester: settings.default_semester || 1,
    fetchSettings: async () => {}, // No-op in fallback
    error: new Error("PlatformSettingsProvider failed, using fallback"),
  }), [settings]);

  return (
    <PlatformSettingsContext.Provider value={value}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}

export function PlatformSettingsProvider({ children }: { children: ReactNode }) {
  return (
    <PlatformSettingsErrorBoundary>
      <PlatformSettingsInternalProvider>
        {children}
      </PlatformSettingsInternalProvider>
    </PlatformSettingsErrorBoundary>
  );
}

function PlatformSettingsInternalProvider({ children }: { children: ReactNode }) {
  const getInitialSemester = () => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("defaultSemester");
      return saved ? Number(saved) : 1;
    }
    return 1;
  };

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PlatformSettings>({ default_semester: getInitialSemester() });
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async (skipCache = false) => {
    try {
      setLoading(true);
      const cacheKey = cacheKeys.settings();

      if (!skipCache) {
        const cached = queryCache.get<PlatformSettings>(cacheKey);
        if (cached) {
          setSettings(cached);
          setLoading(false);
          return;
        }
      }

      const { data, error: fetchError } = await supabase
        .from("platform_settings")
        .select("key, value")
        .eq("key", "default_semester")
        .limit(1)
        .single();

      if (fetchError && fetchError.code !== "PGRST116" && fetchError.code !== "PGRST205") {
        throw fetchError;
      }

      let newSemester = 1;
      if (data && data.value) {
        const v = data.value as unknown;
        const semesterValue =
          typeof v === "object" && v !== null && "semester" in v
            ? (v as { semester?: unknown }).semester
            : undefined;
        newSemester = Number(semesterValue ?? 1);
      }

      const updatedSettings = { default_semester: newSemester };
      setSettings(updatedSettings);
      queryCache.set(cacheKey, updatedSettings, cacheTTL.settings);

      if (typeof window !== "undefined") {
        localStorage.setItem("defaultSemester", newSemester.toString());
      }
      setError(null);
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      logger.error("Failed to fetch platform settings", e);
      setError(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSettings();
  }, [fetchSettings]);

  // Optimistic local updates (admin RPC already committed server-side).
  useEffect(() => {
    const onLocalChange = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (typeof detail === "number" && detail >= 1 && detail <= 3) {
        setSettings({ default_semester: detail });
        if (typeof window !== "undefined") {
          localStorage.setItem("defaultSemester", detail.toString());
        }
      }
    };
    window.addEventListener(DEFAULT_SEMESTER_EVENT, onLocalChange);
    return () => window.removeEventListener(DEFAULT_SEMESTER_EVENT, onLocalChange);
  }, []);

  // Realtime Subscription (Unified)
  useEffect(() => {
    let mounted = true;
    let channel: RealtimeChannel | null = null;

    const setupRealtime = () => {
      const channelId = Math.random().toString(36).substring(7);
      const channelName = `platform_settings_global_${channelId}`;

      logger.info(`Initializing global realtime channel: ${channelName}`);
      const newChannel = supabase.channel(channelName);
      channel = newChannel;

      newChannel
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "platform_settings",
            filter: "key=eq.default_semester",
          },
          (payload: RealtimePostgresChangesPayload<PlatformSettingsRow>) => {
            if (!mounted) return;
            if (!payload.new || !("value" in payload.new)) return;

            const value = payload.new.value as PlatformSettingsValue;
            if (!value || typeof value.semester === "undefined") return;

            const newVal = Number(value.semester);
            if (!isNaN(newVal)) {
              logger.info(`Realtime update received: Default semester ${newVal}`);
              setSettings({ default_semester: newVal });
              if (typeof window !== "undefined") {
                localStorage.setItem("defaultSemester", newVal.toString());
              }
            }
          }
        )
        .subscribe((status: string) => {
          if (status === "SUBSCRIBED") {
            logger.info("Global settings channel subscribed");
          } else if (status === "SUBSCRIPTION_ERROR" && mounted) {
            logger.error(`Realtime subscription error for: ${channelName}`);
            setError(new Error(`Realtime subscription error: ${status}`));
          }
        });
    };

    setupRealtime();

    return () => {
      mounted = false;
      if (channel) {
        logger.info("Cleaning up global realtime channel");
        supabase.removeChannel(channel).catch((err: Error) => logger.error("Cleanup error", err));
      }
    };
  }, []);

  const value = useMemo(() => ({
    loading,
    settings,
    defaultSemester: settings.default_semester || 1,
    fetchSettings,
    error,
  }), [loading, settings, fetchSettings, error]);

  return (
    <PlatformSettingsContext.Provider value={value}>
      {children}
    </PlatformSettingsContext.Provider>
  );
}


export function usePlatformSettingsContext() {
  const context = useContext(PlatformSettingsContext);
  if (context === undefined) {
    throw new Error("usePlatformSettingsContext must be used within a PlatformSettingsProvider");
  }
  return context;
}

export function useOptionalPlatformSettingsContext() {
  return useContext(PlatformSettingsContext);
}
