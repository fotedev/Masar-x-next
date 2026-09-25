/**
 * Academic profile (spec 019 C4) — data access + pure helpers for the
 * level/department/semester path stored on the Supabase `profiles` row
 * (RLS profiles_update_own) and the `academic_levels`/`departments`
 * option tables, ported from the web's useUserAcademic/useAcademicOptions.
 *
 * Pure parts (filter strings, resolution rules) are unit-tested and
 * lock the owner-note #1 verification: the subjects query uses TWO
 * separate chained `.or()` calls — `level.eq.X,level.is.null` and
 * `semester.eq.Y,semester.is.null` — exactly the strings web's
 * useSubjects builds verbatim (each an independent top-level condition,
 * ANDed by PostgREST; never merged into one .or() argument).
 *
 * Cross-screen sync: ProfileScreen saves through saveAcademicProfile,
 * which notifies subscribers; the useAcademicProfile hook instances
 * (Profile + Subjects tabs) reload on notify, so the Subjects filter
 * follows an academic-path edit without an app restart.
 */
import type { SupabaseClient } from "masarx-shared/supabase";

export interface AcademicProfile {
  level: number | null;
  semester: number | null;
  department_id: string | null;
}

export interface AcademicLevelRow {
  id: string;
  name: string;
  level_number: number;
  is_active: boolean | null;
  sort_order: number | null;
}

export interface AcademicDepartmentRow {
  id: string;
  academic_level_id: string;
  name: string;
  is_active: boolean | null;
  sort_order: number | null;
}

export interface AcademicOptions {
  levels: AcademicLevelRow[];
  departments: AcademicDepartmentRow[];
}

/** Web parity: semesters are 1–3 (3 = summer); anything else resolves to 1. */
export function resolveEffectiveSemester(
  semester: number | null | undefined,
): 1 | 2 | 3 {
  return semester === 1 || semester === 2 || semester === 3 ? semester : 1;
}

/** Web parity: effectiveLevel = Number(params.level ?? academic.level ?? 1). */
export function resolveEffectiveLevel(level: number | null | undefined): number {
  return typeof level === "number" && Number.isFinite(level) && level >= 1
    ? level
    : 1;
}

// --- Owner note #1: these strings are web's useSubjects .or() arguments,
// --- verbatim. Each is an INDEPENDENT chained call (ANDed); never merge
// --- them into one .or("…,…") argument.
export function isAcademicFilter(): string {
  return "is_academic.eq.true,is_academic.is.null";
}

export function levelOrNullFilter(level: number): string {
  return `level.eq.${level},level.is.null`;
}

export function semesterOrNullFilter(semester: number): string {
  return `semester.eq.${semester},semester.is.null`;
}

/** Read the signed-in user's academic path (profiles_update_own RLS mirrors this). */
export async function fetchAcademicProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<AcademicProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("level, semester, department_id")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as AcademicProfile | null) ?? null;
}

/** Save the academic path (RLS: own row only). Notifies subscribers on success. */
export async function saveAcademicProfile(
  supabase: SupabaseClient,
  userId: string,
  values: AcademicProfile,
): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      level: values.level,
      semester: values.semester,
      department_id: values.department_id,
    })
    .eq("id", userId);
  if (error) throw error;
  notifyAcademicListeners();
}

/** Option lists for the pickers (same selects/orders as web useAcademicOptions). */
export async function fetchAcademicOptions(
  supabase: SupabaseClient,
): Promise<AcademicOptions> {
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
  if (levelsRes.error) throw levelsRes.error;
  if (departmentsRes.error) throw departmentsRes.error;
  return {
    levels: (levelsRes.data ?? []) as unknown as AcademicLevelRow[],
    departments: (departmentsRes.data ?? []) as unknown as AcademicDepartmentRow[],
  };
}

/** Departments belonging to the selected level (web: academic_level_id filter). */
export function departmentsForLevel(
  options: AcademicOptions,
  levelId: string | null,
): AcademicDepartmentRow[] {
  if (!levelId) return [];
  return options.departments.filter((d) => d.academic_level_id === levelId);
}

// --- tiny subscriber registry for cross-tab live sync -----------------------

type AcademicListener = () => void;
const listeners = new Set<AcademicListener>();

export function subscribeAcademic(listener: AcademicListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyAcademicListeners(): void {
  listeners.forEach((listener) => listener());
}
