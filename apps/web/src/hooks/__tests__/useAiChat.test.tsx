// Spec 040 Wave 3 — useAiChat unit tests.
// THE regression lock for the event-driven guest persistence (spec 036):
// writes may only happen when a real append event raised pendingPersistRef —
// never on mount, mode switch, auth transition, or streaming commit.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { User } from "@supabase/supabase-js";

const { chain, generateResponseMock, buildStudentContextMock, intlState } =
  await vi.hoisted(async () => {
    const { createSupabaseMock } = await import("@/test/mocks/supabase");
    return {
      chain: createSupabaseMock(),
      generateResponseMock: vi.fn(),
      buildStudentContextMock: vi.fn(async () => ({
        context: "CTX",
        sources: [{ source_id: "s1", title: "t" }],
      })),
      intlState: { locale: "ar" },
    };
  });

vi.mock("@/lib/supabase", () => ({ supabase: chain.supabase }));
vi.mock("@/lib/ai-assistant", () => ({
  aiAssistant: {
    generateResponse: generateResponseMock,
    getPuterStatus: vi.fn(() => ({ isAIWorking: true, isSignedIn: false, status: "puter_js" })),
  },
}));
vi.mock("@/hooks/useUserAcademic", () => ({
  useUserAcademic: () => ({
    academic: { level: 3, semester: 2, department_id: null },
  }),
}));
vi.mock("@/lib/student-agent/contextBuilder", () => ({
  buildStudentContext: buildStudentContextMock,
}));

// NOTE: the shared @/test/mocks/next-intl mockNextIntl() helper cannot be
// used from tests — vitest hoists the vi.mock() call out of the helper's
// function body, so its `locale` closure parameter is lost (ReferenceError).
// Inlined here with the same namespace-echo shape until the helper is
// reworked to read a vi.hoisted state holder.
vi.mock("next-intl", () => ({
  useLocale: () => intlState.locale,
  useTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
  getTranslations: (ns: string) => (key: string) => `${ns}.${key}`,
}));

import { useAiChat } from "../useAiChat";
import { cannedMessagesFor } from "@/lib/ai/canned-messages";

const PREFIX = "ai_assistant_chat_messages";
const keyFor = (mode: string) => `${PREFIX}_${mode}`;
const MODE_A = "cs_assistant";

const setItemSpy = vi.spyOn(Storage.prototype, "setItem");
const removeItemSpy = vi.spyOn(Storage.prototype, "removeItem");

// Chat-key writes recorded since the last clearWriteLog(). The test's own
// localStorage seeding ALSO flows through the spied prototype method, so
// every test that seeds must call clearWriteLog() right after seeding.
const chatWrites = () =>
  setItemSpy.mock.calls.filter(([k]) => String(k).startsWith(PREFIX));
const chatRemovals = () =>
  removeItemSpy.mock.calls.filter(([k]) => String(k).startsWith(PREFIX));
const clearWriteLog = () => {
  setItemSpy.mockClear();
  removeItemSpy.mockClear();
};

const mkMsg = (i: number, type: "user" | "assistant" = "user") => ({
  id: `seed-${i}`,
  type,
  content: `seeded ${i}`,
  timestamp: "2026-01-01T00:00:00.000Z",
});

const guestUser = null;
const authUser = { id: "u-1" } as unknown as User;

// Spec 049: seed the restore's current-conversation pick (the restore queries
// conversations with .order().limit(1) — the mock resolves by table+method).
const seedCurrentConversation = (id: string, updatedAt = "2026-01-02T00:00:00.000Z") => {
  chain.respondWith(
    {
      data: [
        {
          id,
          user_id: "u-1",
          mode: MODE_A,
          title: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: updatedAt,
        },
      ],
      error: null,
    },
    { table: "conversations", method: "limit" },
  );
};

function renderChat(user: unknown) {
  return renderHook(({ u }: { u: unknown }) => useAiChat(u as User | null, vi.fn()), {
    initialProps: { u: user },
  });
}

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

beforeEach(() => {
  vi.clearAllMocks();
  clearWriteLog();
  localStorage.clear();
  sessionStorage.clear();
  chain.calls.length = 0;
  // respondWith results are matched most-recent-first and otherwise leak
  // across tests (spec 049: a seeded conversation from one test made a later
  // test's restore pick it up) — reset them alongside the call log.
  chain.resetResponses();
  generateResponseMock.mockResolvedValue("reply");
  // Authenticated chat loads resolve empty by default.
  chain.respondWith({ data: [], error: null }, { table: "ai_chat_messages", method: "range" });
});

describe("guest restore (useLayoutEffect)", () => {
  it("restores a valid stored array with revived Date timestamps and isReady", async () => {
    localStorage.setItem(keyFor(MODE_A), JSON.stringify([mkMsg(0), mkMsg(1, "assistant")]));
    const { result } = renderChat(guestUser);

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0]).toMatchObject({
      id: "seed-0",
      content: "seeded 0",
    });
    expect(result.current.messages[0].timestamp).toBeInstanceOf(Date);
    expect(result.current.isReady).toBe(true);
  });

  it("ignores corrupted JSON and falls back to []", async () => {
    localStorage.setItem(keyFor(MODE_A), "{definitely not json");
    const { result } = renderChat(guestUser);

    expect(result.current.messages).toEqual([]);
    expect(result.current.isReady).toBe(true);
  });

  it("ignores non-array payloads", async () => {
    localStorage.setItem(keyFor(MODE_A), JSON.stringify({ oops: true }));
    const { result } = renderChat(guestUser);

    expect(result.current.messages).toEqual([]);
    expect(result.current.isReady).toBe(true);
  });

  it("uses the persisted last mode for the storage key", async () => {
    localStorage.setItem("zane_ai_last_mode", "group_rag");
    localStorage.setItem(keyFor("group_rag"), JSON.stringify([mkMsg(7)]));
    const { result } = renderChat(guestUser);

    expect(result.current.mode).toBe("group_rag");
    expect(result.current.messages[0].content).toBe("seeded 7");
  });
});

describe("event-driven guest persistence — zero spurious writes", () => {
  it("mount writes nothing to localStorage (the shipped data-loss bug)", () => {
    renderChat(guestUser);
    expect(chatWrites()).toHaveLength(0);
    // Deletion is exclusive to clearChat — the mount must not remove either.
    expect(chatRemovals()).toHaveLength(0);
  });

  it("mode switch writes nothing to chat keys (but records zane_ai_last_mode)", () => {
    localStorage.setItem(keyFor("student_agent"), JSON.stringify([mkMsg(3)]));
    clearWriteLog();
    const { result } = renderChat(guestUser);

    act(() => result.current.setMode("student_agent"));

    expect(result.current.mode).toBe("student_agent");
    expect(result.current.messages[0].content).toBe("seeded 3");
    expect(chatWrites()).toHaveLength(0);
    expect(localStorage.getItem("zane_ai_last_mode")).toBe("student_agent");
  });

  it("auth transition guest → user → guest writes nothing", async () => {
    localStorage.setItem(keyFor(MODE_A), JSON.stringify([mkMsg(0)]));
    clearWriteLog();
    const utils = renderChat(guestUser);
    expect(chatWrites()).toHaveLength(0);

    utils.rerender({ u: authUser });
    await waitFor(() => expect(utils.result.current.isReady).toBe(true));
    expect(chatWrites()).toHaveLength(0);

    utils.rerender({ u: guestUser });
    await waitFor(() => expect(utils.result.current.messages[0].id).toBe("seed-0"));
    expect(chatWrites()).toHaveLength(0);
    expect(chatRemovals()).toHaveLength(0);
  });

  it("a full sendMessage persists the exchange exactly once per raise-consume", async () => {
    const { result } = renderChat(guestUser);

    let send!: Promise<void>;
    await act(async () => {
      send = result.current.sendMessage("hi");
    });

    await act(async () => {
      await send;
    });

    // The user-append and finalize raises may coalesce into one React commit
    // (1 write) or land in separate commits (2 writes) — but never more:
    // streaming commits and restores never write. The streaming tests below
    // lock the per-commit counts; here we lock the final persisted content.
    const writes = chatWrites().length;
    expect(writes).toBeGreaterThanOrEqual(1);
    expect(writes).toBeLessThanOrEqual(2);

    const stored = JSON.parse(localStorage.getItem(keyFor(MODE_A)) || "[]");
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({ type: "user", content: "hi" });
    expect(stored[1]).toMatchObject({ type: "assistant", content: "reply" });
  });

  it("guest writes are capped at the newest 100 messages", async () => {
    const { result } = renderChat(guestUser);

    // First exchange seeds the flow (consumes/raises cleanly).
    await act(async () => {
      await result.current.sendMessage("first");
    });

    const big = Array.from({ length: 101 }, (_, i) => ({
      id: `m${i}`,
      type: "user" as const,
      content: `c${i}`,
      timestamp: new Date(),
    }));
    await act(async () => {
      result.current.setMessages(big);
    });

    await act(async () => {
      await result.current.sendMessage("second");
    });

    const stored = JSON.parse(localStorage.getItem(keyFor(MODE_A)) || "[]");
    expect(stored).toHaveLength(100);
    // 101 seeded + user + assistant = 103 → the first 3 (c0, c1, c2) drop off.
    expect(stored[0].content).toBe("c3");
    expect(stored[stored.length - 1]).toMatchObject({
      type: "assistant",
      content: "reply",
    });
  });

  it("empty message lists never persist", async () => {
    localStorage.setItem(keyFor(MODE_A), JSON.stringify([mkMsg(0)]));
    clearWriteLog();
    const { result } = renderChat(guestUser);
    expect(result.current.messages).toHaveLength(1);

    await act(async () => {
      await result.current.clearChat();
    });

    expect(result.current.messages).toEqual([]);
    expect(localStorage.getItem(keyFor(MODE_A))).toBeNull();
    // The cleared (empty) list is never written back.
    const writtenPayloads = chatWrites().map(([, v]) => String(v));
    expect(writtenPayloads.every((p) => p !== "[]")).toBe(true);
  });
});

describe("deletion via clearChat only", () => {
  it("guest clearChat removes the localStorage key and never touches the DB", async () => {
    localStorage.setItem(keyFor(MODE_A), JSON.stringify([mkMsg(0)]));
    clearWriteLog();
    const { result } = renderChat(guestUser);

    await act(async () => {
      await result.current.clearChat();
    });

    expect(localStorage.getItem(keyFor(MODE_A))).toBeNull();
    expect(
      chain.calls.filter((c) => c.table === "ai_chat_messages" && c.method === "delete"),
    ).toEqual([]);
  });

  it("user clearChat deletes the current conversation — FK cascade takes its messages (spec 049)", async () => {
    seedCurrentConversation("c-1");
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.conversationId).toBe("c-1");

    await act(async () => {
      await result.current.clearChat();
    });

    const del = chain.calls.find(
      (c) => c.table === "conversations" && c.method === "delete",
    );
    expect(del).toBeDefined();
    const eqs = chain.calls
      .filter((c) => c.table === "conversations" && c.method === "eq")
      .map((c) => c.args);
    expect(eqs).toContainEqual(["user_id", "u-1"]);
    expect(eqs).toContainEqual(["id", "c-1"]);
    // Message rows are removed by the ownership-FK cascade — no direct
    // ai_chat_messages delete anymore.
    expect(
      chain.calls.some((c) => c.table === "ai_chat_messages" && c.method === "delete"),
    ).toBe(false);
    expect(result.current.conversationId).toBeNull();
    // Users never write the guest localStorage key.
    expect(chatWrites()).toHaveLength(0);
    expect(chatRemovals()).toHaveLength(0);
  });
});

describe("streaming", () => {
  it("first delta appends streaming:true, later deltas update the same id, finalize clears + persists", async () => {
    let deliver!: (chunks: string[]) => void;
    let resolveResponse!: (value: string) => void;
    generateResponseMock.mockImplementation(
      (_q: string, _c: unknown, opts: { onDelta: (full: string) => void }) =>
        new Promise<string>((resolve) => {
          deliver = (chunks) => chunks.forEach((c) => opts.onDelta(c));
          resolveResponse = resolve;
        }),
    );

    const { result } = renderChat(guestUser);

    let send!: Promise<void>;
    await act(async () => {
      send = result.current.sendMessage("hi");
    });
    expect(chatWrites()).toHaveLength(1);

    await act(async () => {
      deliver(["Hel"]);
      await nextFrame();
    });
    expect(result.current.messages).toHaveLength(2);
    const streaming = result.current.messages[1];
    expect(streaming.type).toBe("assistant");
    expect(streaming.content).toBe("Hel");
    expect(streaming.streaming).toBe(true);
    // Delta flushes never persist.
    expect(chatWrites()).toHaveLength(1);

    await act(async () => {
      deliver(["Hello world"]);
      await nextFrame();
    });
    // SAME message id updated in place.
    expect(result.current.messages[1].id).toBe(streaming.id);
    expect(result.current.messages[1].content).toBe("Hello world");
    expect(result.current.messages[1].streaming).toBe(true);
    expect(chatWrites()).toHaveLength(1);

    await act(async () => {
      resolveResponse("Hello world");
      await send;
    });
    expect(result.current.messages[1].id).toBe(streaming.id);
    expect(result.current.messages[1].streaming).toBe(false);
    expect(result.current.messages[1].content).toBe("Hello world");
    // Finalize persisted exactly once more.
    expect(chatWrites()).toHaveLength(2);
    const stored = JSON.parse(localStorage.getItem(keyFor(MODE_A)) || "[]");
    expect(stored).toHaveLength(2);
  });

  it("error after partial stream keeps the partial text without a duplicate error bubble", async () => {
    generateResponseMock.mockImplementation(
      async (_q: string, _c: unknown, opts: { onDelta: (full: string) => void }) => {
        opts.onDelta("Partial");
        await nextFrame();
        throw new Error("stream died");
      },
    );

    const { result } = renderChat(guestUser);

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1]).toMatchObject({
      type: "assistant",
      content: "Partial",
      streaming: false,
    });
    expect(
      result.current.messages.some((m) => m.id.startsWith("error_")),
    ).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("error before any stream appends the genericError canned message", async () => {
    generateResponseMock.mockRejectedValue(new Error("puter down"));
    const { result } = renderChat(guestUser);

    await act(async () => {
      await result.current.sendMessage("hi");
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[1].content).toBe(
      cannedMessagesFor("ar").genericError,
    );
    expect(result.current.isLoading).toBe(false);
  });

  it("mode switch mid-stream discards the in-flight response without contaminating either key", async () => {
    let deliver!: (chunks: string[]) => void;
    let resolveResponse!: (value: string) => void;
    generateResponseMock.mockImplementation(
      (_q: string, _c: unknown, opts: { onDelta: (full: string) => void }) =>
        new Promise<string>((resolve) => {
          deliver = (chunks) => chunks.forEach((c) => opts.onDelta(c));
          resolveResponse = resolve;
        }),
    );

    const { result } = renderChat(guestUser);

    let send!: Promise<void>;
    await act(async () => {
      send = result.current.sendMessage("hi");
    });
    await act(async () => {
      deliver(["Hel"]);
      await nextFrame();
    });
    expect(result.current.messages).toHaveLength(2);
    const writesBeforeSwitch = chatWrites().length;

    // Switch modes: the guest layout effect re-restores from the NEW key.
    act(() => result.current.setMode("student_agent"));
    expect(result.current.messages).toEqual([]);

    await act(async () => {
      resolveResponse("Hello world");
      await send;
    });

    // The response was discarded — no partial, no full text anywhere.
    expect(
      result.current.messages.some((m) => m.content.includes("Hello world")),
    ).toBe(false);
    expect(result.current.messages).toEqual([]);
    // Mode A key was never rewritten with foreign content; mode B key never
    // created (empty lists never persist).
    const modeAStored = JSON.parse(localStorage.getItem(keyFor(MODE_A)) || "[]");
    expect(modeAStored.some((m: { content: string }) => m.content.includes("Hello world"))).toBe(false);
    expect(localStorage.getItem(keyFor("student_agent"))).toBeNull();
    expect(chatWrites().length).toBe(writesBeforeSwitch);
  });
});

describe("student_agent gating", () => {
  it("without a selected subject: nudge message, no generateResponse, no context build", async () => {
    const { result } = renderChat(guestUser);

    act(() => result.current.setMode("student_agent"));
    await act(async () => {
      await result.current.sendMessage("ما هو E=mc²؟");
    });

    expect(generateResponseMock).not.toHaveBeenCalled();
    expect(buildStudentContextMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].type).toBe("assistant");
    // Nudge copy is i18n now (spec 041 #208) — echo mock pins the key.
    expect(result.current.messages[0].content).toContain("studentAgentNeedsSubject");
  });
});

describe("loadOlder (authenticated lazy history)", () => {
  it("prepends the older page and terminates hasMoreOlder on a short page", async () => {
    // Rows newest-first, as the DB orders them (created_at desc).
    const rows = (n: number, base: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `m${base + i}`,
        role: i % 2 === 0 ? "user" : "assistant",
        content: `c${base + i}`,
        created_at: new Date(2026, 0, 1, 0, 0, base + i).toISOString(),
      })).reverse();

    // Initial newest page: 30 rows → hasMoreOlder true (full page, under cap).
    seedCurrentConversation("c-1");
    chain.respondWith(
      { data: rows(30, 0), error: null },
      { table: "ai_chat_messages", method: "range" },
    );
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.messages).toHaveLength(30));
    expect(result.current.hasMoreOlder).toBe(true);
    const initialRange = chain.calls.find((c) => c.method === "range");
    expect(initialRange!.args).toEqual([0, 29]);

    // Next older page: only 3 rows → short page → hasMoreOlder false.
    chain.respondWith(
      { data: rows(3, 100), error: null },
      { table: "ai_chat_messages", method: "range" },
    );
    await act(async () => {
      await result.current.loadOlder();
    });

    expect(result.current.messages).toHaveLength(33);
    // Older rows were PREPENDED in chronological order after the hook's reverse.
    expect(result.current.messages[0].id).toBe("m100");
    expect(result.current.messages[2].id).toBe("m102");
    expect(result.current.messages[3].id).toBe("m0");
    expect(result.current.hasMoreOlder).toBe(false);
  });

  it("is a no-op for guests (no fetch issued)", async () => {
    const { result } = renderChat(guestUser);
    const callsBefore = chain.calls.length;

    await act(async () => {
      await result.current.loadOlder();
    });

    expect(chain.calls.length).toBe(callsBefore);
    expect(result.current.hasMoreOlder).toBe(false);
  });
});

describe("conversation identity (spec 049)", () => {
  const convRow = (id: string, updatedAt: string) => ({
    id,
    user_id: "u-1",
    mode: MODE_A,
    title: null as string | null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: updatedAt,
  });
  const msgRows = (n: number, convId = "c-1") =>
    Array.from({ length: n }, (_, i) => ({
      id: `m${i}`,
      role: i % 2 === 0 ? "user" : "assistant",
      content: `c${i}`,
      conversation_id: convId,
      created_at: new Date(2026, 0, 1, 0, 0, i).toISOString(),
    })).reverse();

  it("restore picks the most recently active conversation and loads its newest page", async () => {
    // Deliberately unsorted payload — the pick must use updated_at, not order.
    chain.respondWith(
      { data: [convRow("c-old", "2026-01-01T00:00:00.000Z"), convRow("c-new", "2026-01-05T00:00:00.000Z")], error: null },
      { table: "conversations", method: "limit" },
    );
    chain.respondWith(
      { data: msgRows(3, "c-new"), error: null },
      { table: "ai_chat_messages", method: "range" },
    );
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.conversationId).toBe("c-new");
    expect(result.current.messages).toHaveLength(3);
    const eqs = chain.calls
      .filter((c) => c.table === "ai_chat_messages" && c.method === "eq")
      .map((c) => c.args);
    expect(eqs).toContainEqual(["conversation_id", "c-new"]);
    // Conversation identity replaces the mode filter on message queries.
    expect(eqs).not.toContainEqual(["mode", MODE_A]);
  });

  it("restore with no conversations yet stays empty and ready without a message query", async () => {
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.isReady).toBe(true));

    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
    expect(
      chain.calls.some((c) => c.table === "ai_chat_messages" && c.method === "range"),
    ).toBe(false);
    // Restore only reads — the persistence policy (spec 036 lesson) extends
    // to the conversation entity: no conversations writes on mount.
    expect(
      chain.calls.some(
        (c) => c.table === "conversations" && ["insert", "update", "delete"].includes(c.method),
      ),
    ).toBe(false);
  });

  it("first signed-in send creates the conversation (titled) and links both rows", async () => {
    chain.respondWith({ data: { id: "c-1" }, error: null }, { table: "conversations", method: "single" });
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.sendMessage("ما هي الشجرة الثنائية؟");
    });
    await waitFor(() =>
      expect(
        chain.calls.filter((c) => c.table === "ai_chat_messages" && c.method === "insert"),
      ).toHaveLength(2),
    );

    const convInserts = chain.calls.filter((c) => c.table === "conversations" && c.method === "insert");
    expect(convInserts).toHaveLength(1);
    expect(convInserts[0].args[0]).toEqual({
      user_id: "u-1",
      mode: MODE_A,
      title: "ما هي الشجرة الثنائية؟",
    });
    // ensureConversation chain: insert → select("id") → single()
    expect(chain.calls.some((c) => c.table === "conversations" && c.method === "single")).toBe(true);

    const msgInserts = chain.calls
      .filter((c) => c.table === "ai_chat_messages" && c.method === "insert")
      .map((c) => c.args[0] as Record<string, unknown>);
    // The user insert is fire-and-forget (its ensureConversation awaits a
    // microtask), so under the instant mock it can land AFTER the assistant
    // insert — assert per role, not by index.
    const userInsert = msgInserts.find((m) => m.role === "user");
    const assistantInsert = msgInserts.find((m) => m.role === "assistant");
    expect(userInsert).toMatchObject({
      content: "ما هي الشجرة الثنائية؟",
      conversation_id: "c-1",
    });
    expect(assistantInsert).toMatchObject({ content: "reply", conversation_id: "c-1" });
    expect(result.current.conversationId).toBe("c-1");
  });

  it("a failed conversation create still inserts rows unlinked (spec-008 fire-and-forget)", async () => {
    chain.respondWith(
      { data: null, error: { message: "rls denied" } },
      { table: "conversations", method: "single" },
    );
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.sendMessage("hi");
    });
    await waitFor(() =>
      expect(
        chain.calls.filter((c) => c.table === "ai_chat_messages" && c.method === "insert"),
      ).toHaveLength(2),
    );

    expect(chain.calls.filter((c) => c.table === "conversations" && c.method === "insert")).toHaveLength(1);
    const msgInserts = chain.calls
      .filter((c) => c.table === "ai_chat_messages" && c.method === "insert")
      .map((c) => c.args[0] as Record<string, unknown>);
    // Order-independent (see the linked-rows test above).
    expect(msgInserts.find((m) => m.role === "user")).toMatchObject({ conversation_id: null });
    expect(msgInserts.find((m) => m.role === "assistant")).toMatchObject({ conversation_id: null });
    expect(result.current.conversationId).toBeNull();
  });

  it("subsequent sends reuse the existing conversation (no second create)", async () => {
    chain.respondWith({ data: { id: "c-1" }, error: null }, { table: "conversations", method: "single" });
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.sendMessage("first");
    });
    await waitFor(() =>
      expect(
        chain.calls.filter((c) => c.table === "ai_chat_messages" && c.method === "insert"),
      ).toHaveLength(2),
    );
    await act(async () => {
      await result.current.sendMessage("second");
    });
    await waitFor(() =>
      expect(
        chain.calls.filter((c) => c.table === "ai_chat_messages" && c.method === "insert"),
      ).toHaveLength(4),
    );

    expect(chain.calls.filter((c) => c.table === "conversations" && c.method === "insert")).toHaveLength(1);
    expect(result.current.conversationId).toBe("c-1");
  });

  it("prune is scoped to the conversation, not the mode", async () => {
    seedCurrentConversation("c-1");
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.sendMessage("hi");
    });
    await waitFor(() =>
      expect(
        chain.calls.filter((c) => c.table === "ai_chat_messages" && c.method === "insert"),
      ).toHaveLength(2),
    );

    // The overflow probe selects ids scoped by conversation_id (no mode filter).
    const probeIdx = chain.calls.findIndex(
      (c) =>
        c.table === "ai_chat_messages" &&
        c.method === "select" &&
        JSON.stringify(c.args) === '["id"]',
    );
    expect(probeIdx).toBeGreaterThan(-1);
    const eqAfterProbe = chain.calls[probeIdx + 1];
    expect(eqAfterProbe.method).toBe("eq");
    expect(eqAfterProbe.args).toEqual(["conversation_id", "c-1"]);
  });

  it("switchConversation loads that conversation's transcript", async () => {
    seedCurrentConversation("c-1");
    chain.respondWith(
      { data: msgRows(2, "c-1"), error: null },
      { table: "ai_chat_messages", method: "range" },
    );
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.messages).toHaveLength(2);

    // Switch target: distinct rows for its newest page.
    chain.respondWith(
      { data: msgRows(2, "c-2").map((r, i) => ({ ...r, id: `o${i}` })), error: null },
      { table: "ai_chat_messages", method: "range" },
    );
    await act(async () => {
      await result.current.switchConversation("c-2");
    });

    expect(result.current.conversationId).toBe("c-2");
    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages.every((m) => m.id.startsWith("o"))).toBe(true);
    expect(result.current.isReady).toBe(true);
  });

  it("deleteConversation removes server-side and resets the transcript when current", async () => {
    seedCurrentConversation("c-1");
    const { result } = renderChat(authUser);
    await waitFor(() => expect(result.current.isReady).toBe(true));

    await act(async () => {
      await result.current.deleteConversation("c-1");
    });

    const del = chain.calls.find((c) => c.table === "conversations" && c.method === "delete");
    expect(del).toBeDefined();
    const eqs = chain.calls
      .filter((c) => c.table === "conversations" && c.method === "eq")
      .map((c) => c.args);
    expect(eqs).toContainEqual(["user_id", "u-1"]);
    expect(eqs).toContainEqual(["id", "c-1"]);
    expect(result.current.messages).toEqual([]);
    expect(result.current.conversationId).toBeNull();
  });

  it("mount and auth transitions never write conversations (event-driven policy)", async () => {
    const utils = renderChat(guestUser);
    utils.rerender({ u: authUser });
    await waitFor(() => expect(utils.result.current.isReady).toBe(true));
    utils.rerender({ u: guestUser });

    const convWrites = chain.calls.filter(
      (c) => c.table === "conversations" && ["insert", "update", "delete"].includes(c.method),
    );
    expect(convWrites).toHaveLength(0);
    expect(chatWrites()).toHaveLength(0);
    expect(chatRemovals()).toHaveLength(0);
  });
});
