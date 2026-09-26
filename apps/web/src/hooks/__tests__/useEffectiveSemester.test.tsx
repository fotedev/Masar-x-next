import { describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const { platformSettings } = vi.hoisted(() => ({
  platformSettings: { defaultSemester: 1, loading: false },
}));

vi.mock("@/hooks/usePlatformSettings", () => ({
  usePlatformSettings: () => platformSettings,
}));

import {
  GUEST_SEMESTER_EVENT,
  GUEST_SEMESTER_STORAGE_KEY,
  readGuestSemester,
  useEffectiveSemester,
  writeGuestSemester,
} from "../useEffectiveSemester";

describe("readGuestSemester / writeGuestSemester", () => {
  it("round-trips a valid semester through localStorage", () => {
    localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
    expect(readGuestSemester()).toBeNull();
    writeGuestSemester(2);
    expect(readGuestSemester()).toBe(2);
    expect(localStorage.getItem(GUEST_SEMESTER_STORAGE_KEY)).toBe("2");
    localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
  });

  it("rejects out-of-range semesters (1..3 only)", () => {
    writeGuestSemester(4 as never);
    expect(readGuestSemester()).toBeNull();
    localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
  });

  it("returns null for corrupted storage", () => {
    localStorage.setItem(GUEST_SEMESTER_STORAGE_KEY, "garbage");
    expect(readGuestSemester()).toBeNull();
    localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
  });
});

describe("useEffectiveSemester (spec 013 resolution order)", () => {
  it("profile semester wins over everything", () => {
    localStorage.setItem(GUEST_SEMESTER_STORAGE_KEY, "3");
    const { result } = renderHook(() => useEffectiveSemester(2));
    expect(result.current.effectiveSemester).toBe(2);
    localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
  });

  it("invalid profile semesters fall back to guest choice then platform default", () => {
    const { result: guest } = renderHook(() => useEffectiveSemester(7 as never));
    expect(guest.current.effectiveSemester).toBe(1); // platform default (no guest value)
    expect(guest.current.guestSemester).toBeNull();
  });

  it("guest localStorage choice applies for null profile", async () => {
    localStorage.setItem(GUEST_SEMESTER_STORAGE_KEY, "3");
    const { result } = renderHook(() => useEffectiveSemester(null));
    await waitFor(() => expect(result.current.effectiveSemester).toBe(3));
    localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
  });

  it("reacts to the guest-semester custom event live", async () => {
    const { result } = renderHook(() => useEffectiveSemester(null));
    expect(result.current.effectiveSemester).toBe(1);
    await act(async () => {
      writeGuestSemester(2);
    });
    expect(result.current.effectiveSemester).toBe(2);
    localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
  });

  it("uses the platform default when neither profile nor guest choice exists", () => {
    localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
    const { result } = renderHook(() => useEffectiveSemester(null));
    expect(result.current.effectiveSemester).toBe(platformSettings.defaultSemester);
  });

  it("always returns a number 1..3 (PostgREST interpolation guard)", () => {
    for (const profile of [null, 0, 99, undefined]) {
      localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
      const { result } = renderHook(() => useEffectiveSemester(profile as never));
      expect(Number.isInteger(result.current.effectiveSemester)).toBe(true);
      expect([1, 2, 3]).toContain(result.current.effectiveSemester);
    }
  });

  it("ignores invalid payloads on the custom event", async () => {
    localStorage.removeItem(GUEST_SEMESTER_STORAGE_KEY);
    const { result } = renderHook(() => useEffectiveSemester(null));
    await act(async () => {
      window.dispatchEvent(new CustomEvent(GUEST_SEMESTER_EVENT, { detail: 9 }));
    });
    expect(result.current.guestSemester).toBeNull();
  });
});
