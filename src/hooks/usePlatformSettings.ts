import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { queryCache, cacheKeys, cacheTTL } from "../lib/queryCache";

type PlatformSettings = {
  active_semester?: number;
};

export function usePlatformSettings() {
  const getInitialSemester = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('activeSemester');
      return saved ? Number(saved) : 1;
    }
    return 1;
  };

  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PlatformSettings>({ active_semester: getInitialSemester() });

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

      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value")
        .eq("key", "active_semester")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116" && error.code !== "PGRST205") {
        throw error;
      }

      let newSemester = 1;
      if (data && data.value) {
        const v = data.value as unknown;
        const semesterValue =
          typeof v === 'object' && v !== null && 'semester' in v
            ? (v as { semester?: unknown }).semester
            : undefined;
        newSemester = Number(semesterValue ?? 1);
      }

      const updatedSettings = { active_semester: newSemester };
      setSettings(updatedSettings);
      
      // Cache the result
      queryCache.set(cacheKey, updatedSettings, cacheTTL.settings);

      if (typeof window !== 'undefined') {
        localStorage.setItem('activeSemester', newSemester.toString());
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const setActiveSemester = useCallback(async (semester: number) => {
    try {
      setLoading(true);
      const payload = { semester };
      const { error } = await supabase
        .from("platform_settings")
        .upsert({ key: "active_semester", value: payload, updated_at: new Date().toISOString() }, { onConflict: "key" });

      if (error) throw error;
      
      const updatedSettings = { active_semester: semester };
      setSettings(updatedSettings);
      
      // Invalidate cache
      queryCache.delete(cacheKeys.settings());

      if (typeof window !== 'undefined') {
        localStorage.setItem('activeSemester', semester.toString());
        // Dispatch custom event to notify other parts of the UI
        window.dispatchEvent(new CustomEvent('activeSemesterChanged', { detail: semester }));
      }
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();

    // Listen for changes from other components/tabs
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newVal = Number(customEvent.detail);
      if (!isNaN(newVal)) {
        setSettings({ active_semester: newVal });
      }
    };
    
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'activeSemester' && e.newValue) {
        const newVal = Number(e.newValue);
        if (!isNaN(newVal)) {
          setSettings({ active_semester: newVal });
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('activeSemesterChanged', handleCustomEvent);
      window.addEventListener('storage', handleStorageChange);
    }

    // Optional: Realtime subscription to Supabase changes
    const channel = supabase
      .channel('platform_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'platform_settings',
          filter: 'key=eq.active_semester'
        },
        (payload: { new: { value?: { semester?: number } } } | null) => {
          if (!payload) return;
          if (payload.new && payload.new.value) {
            const rawVal = payload.new.value.semester;
            const newVal = Number(rawVal);
            if (!isNaN(newVal)) {
              setSettings({ active_semester: newVal });
              if (typeof window !== 'undefined') {
                localStorage.setItem('activeSemester', newVal.toString());
                // Force a custom event to notify other hooks that might not be using Supabase Realtime
                window.dispatchEvent(new CustomEvent('activeSemesterChanged', { detail: newVal }));
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('activeSemesterChanged', handleCustomEvent);
        window.removeEventListener('storage', handleStorageChange);
      }
      supabase.removeChannel(channel);
    };
  }, [fetchSettings]);

  return {
    loading,
    settings,
    activeSemester: settings.active_semester || 1,
    fetchSettings,
    setActiveSemester,
  };
}

