import { logger } from "../lib/logger";

export const USER_ACADEMIC_CACHE_KEY = "masarx_user_academic_cache";
export const ACADEMIC_FETCH_KEY = "masarx_academic_fetch_timestamp";
const CACHE_KEY = "masarx_academic_options_cache";
export const RATE_LIMIT_KEY = "masarx_academic_rate_limit";
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
export const FETCH_COOLDOWN = 60 * 60 * 1000; // 1 hour

export type AcademicLevel = {
  id: string;
  name: string;
  level_number: number | null;
};

export type Department = {
  id: string;
  name: string;
  academic_level_id: string | null;
};

export type UserAcademic = {
  level: number | null;
  semester: number | null;
  department_id?: string | null;
};

export const DEFAULT_ACADEMIC: UserAcademic = { 
  level: null, 
  semester: null, 
  department_id: null 
};

export const academicCache = {
  getUserAcademic: (userId: string): UserAcademic | null => {
    try {
      // Keyed per user: the next identity on this tab must never read the
      // previous one's academic state (review 2026-11-07 D4).
      const cached = sessionStorage.getItem(
        `${USER_ACADEMIC_CACHE_KEY}:${userId}`
      );
      if (!cached) return null;
      const parsed = JSON.parse(cached);
      // T030: Removed userId from cache to avoid PII in storage
      // We rely on sessionStorage being per-tab/session instead
      if (Date.now() - parsed.timestamp > CACHE_TTL) return null;
      return parsed.data;
    } catch {
      return null;
    }
  },

  setUserAcademic: (userId: string, data: UserAcademic) => {
    try {
      // T030: sessionStorage (not localStorage) for PII protection; keyed
      // per user so identities cannot read each other's state (review D4).
      sessionStorage.setItem(
        `${USER_ACADEMIC_CACHE_KEY}:${userId}`,
        JSON.stringify({
          data,
          timestamp: Date.now(),
        })
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("masarx_user_academic_updated"));
      }
    } catch (e) {
      logger.error("Failed to set user academic cache", e);
    }
  },

  getOptions: () => {
    try {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (!cachedData) return null;
      const parsed = JSON.parse(cachedData);
      if (Date.now() - parsed.lastFetched > CACHE_TTL) return null;
      return { levels: parsed.levels, departments: parsed.departments };
    } catch {
      return null;
    }
  },

  setOptions: (levels: AcademicLevel[], departments: Department[]) => {
    try {
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({
          levels,
          departments,
          lastFetched: Date.now(),
        })
      );
    } catch (e) {
      logger.error("Failed to set academic options cache", e);
    }
  }
};
