// Spec 040 Wave 3 — PlatformSettingsContext unit tests.
// Supabase comes from the shared chain mock; the realtime channel is a
// purpose-built stub capturing the .on postgres_changes callback so tests
// can drive payloads. queryCache runs FOR REAL (its platform_settings key
// is part of the fetch contract) and is reset between tests.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { act } from "react";

const { chain } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/test/mocks/supabase");
  return { chain: createSupabaseMock({ data: null, error: null }) };
});

vi.mock("@/lib/supabase", () => ({ supabase: chain.supabase }));

import {
  PlatformSettingsFallback,
  PlatformSettingsProvider,
  useOptionalPlatformSettingsContext,
} from "../PlatformSettingsContext";
import { queryCache } from "@/lib/queryCache";

// Realtime channel stub capturing the .on callback + filter.
let onHandler: ((payload: unknown) => void) | null = null;
let onFilter: Record<string, unknown> | null = null;
const channelStub = {
  on: vi.fn((_type: string, filter: Record<string, unknown>, cb: (payload: unknown) => void) => {
    onFilter = filter;
    onHandler = cb;
    return channelStub;
  }),
  subscribe: vi.fn(() => channelStub),
};

function Probe() {
  const ctx = useOptionalPlatformSettingsContext();
  if (!ctx) return <div data-testid="ctx">undefined</div>;
  return (
    <div>
      <span data-testid="semester">{ctx.defaultSemester}</span>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <span data-testid="error">{ctx.error ? ctx.error.message : "null"}</span>
    </div>
  );
}

function renderProvider(children = <Probe />) {
  return render(<PlatformSettingsProvider>{children}</PlatformSettingsProvider>);
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  queryCache.invalidatePrefix("");
  chain.calls.length = 0;
  onHandler = null;
  onFilter = null;
  chain.supabase.channel.mockImplementation(() => channelStub);
  // The provider calls .removeChannel(channel).catch(...) on cleanup — the
  // real client returns a promise, so the stub must too.
  chain.supabase.removeChannel.mockResolvedValue(undefined);
});

describe("initial fetch", () => {
  it("queries platform_settings scoped to key=eq.default_semester via .single()", async () => {
    chain.respondWith(
      {
        data: { key: "default_semester", value: { semester: 2 }, updated_at: "2026-01-01" },
        error: null,
      },
      { table: "platform_settings", method: "single" },
    );

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(chain.calls.find((c) => c.method === "eq")!.args).toEqual([
      "key",
      "default_semester",
    ]);
    expect(chain.calls.some((c) => c.method === "limit")).toBe(true);
    expect(chain.calls.some((c) => c.method === "single")).toBe(true);

    expect(screen.getByTestId("semester")).toHaveTextContent("2");
    expect(screen.getByTestId("error")).toHaveTextContent("null");
    // localStorage mirror.
    expect(localStorage.getItem("defaultSemester")).toBe("2");
  });

  it("extracts value.semester and writes the localStorage mirror", async () => {
    chain.respondWith(
      { data: { key: "default_semester", value: { semester: 3 } }, error: null },
      { table: "platform_settings", method: "single" },
    );

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("semester")).toHaveTextContent("3"));
    expect(localStorage.getItem("defaultSemester")).toBe("3");
  });

  it("tolerates PGRST116 (no row) and falls back to semester 1", async () => {
    chain.respondWith(
      { data: null, error: { message: "no rows", code: "PGRST116" } },
      { table: "platform_settings", method: "single" },
    );

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("semester")).toHaveTextContent("1");
    expect(screen.getByTestId("error")).toHaveTextContent("null");
  });

  it("tolerates PGRST205 (table missing) and falls back to semester 1", async () => {
    chain.respondWith(
      { data: null, error: { message: "schema cache", code: "PGRST205" } },
      { table: "platform_settings", method: "single" },
    );

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("semester")).toHaveTextContent("1");
    expect(screen.getByTestId("error")).toHaveTextContent("null");
  });

  it("surfaces other errors as error state without crashing", async () => {
    chain.respondWith(
      { data: null, error: { message: "db exploded", code: "42501" } },
      { table: "platform_settings", method: "single" },
    );

    renderProvider();
    // The raw supabase error object is not an Error instance, so the catch
    // wraps it via String(err) — the state holds *an* error either way.
    await waitFor(() =>
      expect(screen.getByTestId("error")).not.toHaveTextContent("null"),
    );

    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(localStorage.getItem("defaultSemester")).toBeNull();
  });

  it("serves a warm queryCache hit without querying", async () => {
    queryCache.set("platform_settings", { default_semester: 3 }, 60_000);

    renderProvider();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    expect(screen.getByTestId("semester")).toHaveTextContent("3");
    expect(chain.calls.some((c) => c.table === "platform_settings")).toBe(false);
  });
});

describe("defaultSemesterChanged window event (optimistic admin update)", () => {
  it("accepts 1..3, writes the mirror, ignores out-of-range and non-numbers", async () => {
    chain.respondWith(
      { data: null, error: { message: "no rows", code: "PGRST116" } },
      { table: "platform_settings", method: "single" },
    );
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("loading")).toHaveTextContent("false"));

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("defaultSemesterChanged", { detail: 2 }),
      );
    });
    expect(screen.getByTestId("semester")).toHaveTextContent("2");
    expect(localStorage.getItem("defaultSemester")).toBe("2");

    // Out of range → ignored.
    await act(async () => {
      window.dispatchEvent(
        new CustomEvent("defaultSemesterChanged", { detail: 4 }),
      );
      window.dispatchEvent(
        new CustomEvent("defaultSemesterChanged", { detail: 0 }),
      );
      window.dispatchEvent(
        new CustomEvent("defaultSemesterChanged", { detail: "2" }),
      );
    });
    expect(screen.getByTestId("semester")).toHaveTextContent("2");
  });
});

describe("realtime subscription", () => {
  it("subscribes with the platform_settings default_semester filter and cleans up on unmount", async () => {
    chain.respondWith(
      { data: null, error: { message: "no rows", code: "PGRST116" } },
      { table: "platform_settings", method: "single" },
    );
    const { unmount } = renderProvider();
    await waitFor(() => expect(channelStub.on).toHaveBeenCalled());

    expect(onFilter).toEqual({
      event: "*",
      schema: "public",
      table: "platform_settings",
      filter: "key=eq.default_semester",
    });

    unmount();
    expect(chain.supabase.removeChannel).toHaveBeenCalledTimes(1);
  });

  it("coerces numeric payload values and updates the mirror", async () => {
    chain.respondWith(
      { data: null, error: { message: "no rows", code: "PGRST116" } },
      { table: "platform_settings", method: "single" },
    );
    renderProvider();
    await waitFor(() => expect(onHandler).not.toBeNull());

    await act(async () => {
      onHandler!({ new: { value: { semester: "3" } } });
    });
    expect(screen.getByTestId("semester")).toHaveTextContent("3");
    expect(localStorage.getItem("defaultSemester")).toBe("3");
  });

  it("ignores malformed realtime payloads", async () => {
    chain.respondWith(
      {
        data: { key: "default_semester", value: { semester: 2 } },
        error: null,
      },
      { table: "platform_settings", method: "single" },
    );
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("semester")).toHaveTextContent("2"));

    await act(async () => {
      onHandler!({ new: {} }); // no value
      onHandler!({ new: { value: null } }); // null value
      onHandler!({ new: { value: { semester: "abc" } } }); // NaN after coercion
      onHandler!({}); // no new at all
    });
    expect(screen.getByTestId("semester")).toHaveTextContent("2");
    expect(localStorage.getItem("defaultSemester")).toBe("2");
  });
});

describe("PlatformSettingsFallback", () => {
  it("renders a non-undefined context with the mirrored semester and the failure error", () => {
    // Rendered directly (exported for this test): when engaged through the
    // error boundary, the fallback's context is shadowed by the re-mounted
    // internal provider, so a direct render is the only observable path.
    localStorage.setItem("defaultSemester", "3");
    render(
      <PlatformSettingsFallback>
        <Probe />
      </PlatformSettingsFallback>,
    );

    expect(screen.queryByTestId("ctx")).not.toBeInTheDocument();
    expect(screen.getByTestId("semester")).toHaveTextContent("3");
    expect(screen.getByTestId("loading")).toHaveTextContent("false");
    expect(screen.getByTestId("error")).toHaveTextContent(
      "PlatformSettingsProvider failed, using fallback",
    );
  });
});
