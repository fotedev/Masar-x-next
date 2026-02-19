import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";

export type UserAcademic = {
  level: number | null;
  semester: number | null;
};

const DEFAULT_ACADEMIC: UserAcademic = { level: null, semester: null };

export function useUserAcademic() {
  const { user, loading: authLoading } = useAuth();
  const [academic, setAcademic] = useState<UserAcademic>(DEFAULT_ACADEMIC);
  const [loading, setLoading] = useState(true);

  const fetchAcademic = useCallback(async () => {
    if (!user) {
      setAcademic(DEFAULT_ACADEMIC);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("profiles")
        .select("level, semester")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;

      setAcademic({
        level: typeof data?.level === "number" ? data.level : null,
        semester: typeof data?.semester === "number" ? data.semester : null,
      });
    } catch {
      setAcademic(DEFAULT_ACADEMIC);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const setUserAcademic = useCallback(
    async (next: UserAcademic): Promise<boolean> => {
      if (!user) return false;

      try {
        setLoading(true);
        const { error } = await supabase.from("profiles").upsert(
          {
            id: user.id,
            level: next.level,
            semester: next.semester,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" },
        );

        if (error) throw error;
        setAcademic(next);
        return true;
      } catch {
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user],
  );

  useEffect(() => {
    if (authLoading) return;
    fetchAcademic();
  }, [authLoading, fetchAcademic]);

  return {
    academic,
    userLevel: academic.level,
    userSemester: academic.semester,
    loading,
    fetchAcademic,
    setUserAcademic,
  };
}
