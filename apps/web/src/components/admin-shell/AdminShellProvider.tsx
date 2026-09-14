"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import { allGroupIds } from "@/lib/admin-shell/navigation";
import { readJSON, writeJSON } from "@/lib/admin-shell/storage";

/**
 * AdminShellProvider — single source of truth for the admin sidebar UI state.
 *
 * State:   collapsed (desktop rail), expandedGroups (open nav sections),
 *          mobileOpen (off-canvas drawer), hydrated (storage applied).
 * Persist: { collapsed, expandedGroups } -> localStorage "ax.sidebar",
 *          crash-proof parsing + shape validation.
 * SSR:     the first render always uses deterministic defaults, so server and
 *          client markup match (no hydration mismatch); storage is applied in
 *          useEffect after mount.
 */

const STORAGE_KEY = "ax.sidebar";

export interface AdminShellState {
  collapsed: boolean;
  expandedGroups: string[];
  mobileOpen: boolean;
  /** False until stored preferences have been applied. */
  hydrated: boolean;
}

export interface AdminShellActions {
  toggleCollapsed: () => void;
  toggleGroup: (groupId: string) => void;
  openGroup: (groupId: string) => void;
  setMobileOpen: (open: boolean) => void;
}

export interface AdminShellContextValue {
  state: AdminShellState;
  actions: AdminShellActions;
}

interface StoredShape {
  collapsed: boolean;
  expandedGroups: string[];
}

type Action =
  | { type: "hydrate"; collapsed: boolean; expandedGroups: string[] }
  | { type: "toggle-collapsed" }
  | { type: "toggle-group"; groupId: string }
  | { type: "open-group"; groupId: string }
  | { type: "set-mobile-open"; open: boolean };

const initialState: AdminShellState = {
  collapsed: false,
  expandedGroups: allGroupIds,
  mobileOpen: false,
  hydrated: false,
};

function isStoredShape(value: unknown): value is StoredShape {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.collapsed === "boolean" &&
    Array.isArray(v.expandedGroups) &&
    v.expandedGroups.every((id) => typeof id === "string")
  );
}

function reducer(state: AdminShellState, action: Action): AdminShellState {
  switch (action.type) {
    case "hydrate":
      return {
        ...state,
        collapsed: action.collapsed,
        expandedGroups: action.expandedGroups,
        hydrated: true,
      };
    case "toggle-collapsed":
      return { ...state, collapsed: !state.collapsed };
    case "toggle-group":
      return {
        ...state,
        expandedGroups: state.expandedGroups.includes(action.groupId)
          ? state.expandedGroups.filter((id) => id !== action.groupId)
          : [...state.expandedGroups, action.groupId],
      };
    case "open-group":
      return state.expandedGroups.includes(action.groupId)
        ? state
        : { ...state, expandedGroups: [...state.expandedGroups, action.groupId] };
    case "set-mobile-open":
      return { ...state, mobileOpen: action.open };
    default:
      return state;
  }
}

const AdminShellContext = createContext<AdminShellContextValue | null>(null);

export function AdminShellProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const hydratedRef = useRef(false);

  // One-shot hydration after mount (SSR-safe). Tablet widths start on the rail
  // when no stored preference exists.
  useEffect(() => {
    const stored = readJSON<StoredShape | null>(
      STORAGE_KEY,
      null,
      (v): v is StoredShape | null => v === null || isStoredShape(v),
    );

    let collapsed: boolean;
    let expandedGroups: string[];

    if (stored) {
      const valid = stored.expandedGroups.filter((id) => allGroupIds.includes(id));
      collapsed = stored.collapsed;
      expandedGroups = valid.length > 0 ? valid : allGroupIds;
    } else {
      const isTablet = window.matchMedia(
        "(min-width: 768px) and (max-width: 1023px)",
      ).matches;
      collapsed = isTablet;
      expandedGroups = allGroupIds;
    }

    hydratedRef.current = true;
    dispatch({ type: "hydrate", collapsed, expandedGroups });
  }, []);

  // Persist user preferences only after hydration, so defaults never overwrite
  // stored choices on first load.
  useEffect(() => {
    if (!state.hydrated || !hydratedRef.current) return;
    writeJSON(STORAGE_KEY, {
      collapsed: state.collapsed,
      expandedGroups: state.expandedGroups,
    });
  }, [state.hydrated, state.collapsed, state.expandedGroups]);

  const toggleCollapsed = useCallback(() => dispatch({ type: "toggle-collapsed" }), []);
  const toggleGroup = useCallback(
    (groupId: string) => dispatch({ type: "toggle-group", groupId }),
    [],
  );
  const openGroup = useCallback(
    (groupId: string) => dispatch({ type: "open-group", groupId }),
    [],
  );
  const setMobileOpen = useCallback(
    (open: boolean) => dispatch({ type: "set-mobile-open", open }),
    [],
  );

  // Actions identity is stable across state changes (effects depend on it).
  const actions = useMemo<AdminShellActions>(
    () => ({ toggleCollapsed, toggleGroup, openGroup, setMobileOpen }),
    [toggleCollapsed, toggleGroup, openGroup, setMobileOpen],
  );

  const value = useMemo<AdminShellContextValue>(
    () => ({ state, actions }),
    [state, actions],
  );

  return (
    <AdminShellContext.Provider value={value}>
      {children}
    </AdminShellContext.Provider>
  );
}

/** Access admin sidebar state/actions. Throws outside the provider. */
export function useAdminShell(): AdminShellContextValue {
  const ctx = useContext(AdminShellContext);
  if (!ctx) throw new Error("useAdminShell must be used within <AdminShellProvider>");
  return ctx;
}