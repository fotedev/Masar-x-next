import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { cacheTTL, queryCache } from "../lib/queryCache";
// Removed hardcoded imports as per user request to rely solely on DB tables

export type AcademicLevelOption = {
  id: string;
  name: string;
  level_number: number | null;
  is_active: boolean;
  sort_order: number;
};

export type DepartmentOption = {
  id: string;
  academic_level_id?: string | null;
  name: string;
  is_active: boolean;
  sort_order: number;
};

type Options = {
  levels: AcademicLevelOption[];
  departments: DepartmentOption[];
};

type Params = {
  includeInactive?: boolean;
};

const isValidAcademicLevel = (lvl: AcademicLevelOption) => {
  const name = (lvl.name || "").trim();
  if (!name) return false;
  if (/^\d+$/.test(name)) return false;

  const n = lvl.level_number;
  if (typeof n === "number") {
    if (!Number.isFinite(n)) return false;
    if (n < 1 || n > 10) return false;
    return true;
  }

  // Fallback for names if no level_number is present
  return name.includes("المستوى") || /^\d+$/.test(name);
};



export function useAcademicOptions(params: Params = {}) {
  const { includeInactive = false } = params;
  const [levels, setLevels] = useState<AcademicLevelOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionsLoading, setOptionsLoading] = useState(true);

  const levelIdByName = useMemo(() => {
    const map = new Map<string, string>();
    for (const lvl of levels) {
      map.set((lvl.name || "").trim(), lvl.id);
    }
    return map;
  }, [levels]);

  const getDepartmentsForLevelName = useCallback(
    (levelName: string) => {
      const id = levelIdByName.get((levelName || "").trim());
      if (!id) return [] as DepartmentOption[];
      return departments.filter((d) => d.academic_level_id === id);
    },
    [departments, levelIdByName],
  );

  const cacheKey = useMemo(() => {
    return `academic_options_v2:inactive:${includeInactive ? 1 : 0}`;
  }, [includeInactive]);

  const fetchOptions = useCallback(async (skipCache = false) => {
    try {
      setLoading(true);
      setOptionsLoading(true);

      if (!skipCache) {
        const cached = queryCache.get<Options>(cacheKey);
        if (cached) {
          setLevels(cached.levels);
          setDepartments(cached.departments);
          setLoading(false);
          setOptionsLoading(false);
          return;
        }
      }

      const [levelsRes, departmentsRes] = await Promise.all([
        supabase
          .from("academic_levels")
          .select("id,name,level_number,is_active,sort_order")
          .order("sort_order", { ascending: true }),
        supabase
          .from("departments")
          .select("id,academic_level_id,name,is_active,sort_order")
          .order("sort_order", { ascending: true }),
      ]);

      if (levelsRes.error || departmentsRes.error) {
        console.error("Error fetching academic options:", levelsRes.error || departmentsRes.error);
        setLevels([]);
        setDepartments([]);
        return;
      }

      const rawLevels = (levelsRes.data || []) as AcademicLevelOption[];
      const rawDepartments = (departmentsRes.data || []) as DepartmentOption[];

      const validLevels = rawLevels.filter(isValidAcademicLevel);

      const nextLevels = includeInactive
        ? validLevels
        : validLevels.filter((l) => l.is_active);
      const nextDepartments = includeInactive
        ? rawDepartments
        : rawDepartments.filter((d) => d.is_active);

      setLevels(nextLevels);
      setDepartments(nextDepartments);

      queryCache.set(
        cacheKey,
        { levels: nextLevels, departments: nextDepartments },
        cacheTTL.levels,
      );
    } catch (err) {
      console.error("Unexpected error fetching academic options:", err);
      setLevels([]);
      setDepartments([]);
    } finally {
      setLoading(false);
      setOptionsLoading(false);
    }
  }, [cacheKey, includeInactive]);

  useEffect(() => {
    fetchOptions();
  }, [fetchOptions]);

  return {
    levels,
    departments,
    levelIdByName,
    getDepartmentsForLevelName,
    loading,
    optionsLoading,
    refetch: (skipCache = true) => fetchOptions(skipCache),
  };
}
