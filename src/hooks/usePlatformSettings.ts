import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";

type PlatformSettings = {
  active_semester?: number;
};

export function usePlatformSettings() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PlatformSettings>({ active_semester: 1 });

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
        setSettings({ active_semester: Number(v.semester || 1) });
      } else {
        setSettings({ active_semester: 1 });
      }
    } catch (err) {
      console.error("Error fetching platform settings:", err);
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
      return true;
    } catch (err) {
      console.error("Error updating active semester:", err);
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

