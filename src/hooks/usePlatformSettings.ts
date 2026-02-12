import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

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

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value")
        .eq("key", "active_semester")
        .limit(1)
        .single();

      if (error && error.code !== "PGRST116" && error.code !== "PGRST205") {
        // PGRST116 = no rows, PGRST205 = table not found — ignore both
        throw error;
      }

      if (data && data.value) {
        const v = data.value as any;
        const newSemester = Number(v.semester || 1);
        setSettings({ active_semester: newSemester });
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeSemester', newSemester.toString());
        }
      } else {
        setSettings({ active_semester: 1 });
        if (typeof window !== 'undefined') {
          localStorage.setItem('activeSemester', '1');
        }
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
      setSettings({ active_semester: semester });
      if (typeof window !== 'undefined') {
        localStorage.setItem('activeSemester', semester.toString());
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
  }, [fetchSettings]);

  return {
    loading,
    settings,
    activeSemester: settings.active_semester || 1,
    fetchSettings,
    setActiveSemester,
  };
}

