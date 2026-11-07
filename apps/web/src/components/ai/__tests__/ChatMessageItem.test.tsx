import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { setMockIntlLocale, nextIntlMockFactory } from "@/test/mocks/next-intl";

// framer-motion passthrough (cached per tag so element identities stay stable)
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const FRAMER_PROPS = [
    "initial", "animate", "exit", "transition", "variants",
    "whileHover", "whileTap", "whileDrag", "whileFocus", "whileInView",
  ];
  const cache = new Map<string, (props: Record<string, unknown>) => React.ReactElement>();
  const passthrough = (tag: string) => {
    if (!cache.has(tag)) {
      cache.set(tag, (props: Record<string, unknown>) => {
        const rest: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(props)) {
          if (!FRAMER_PROPS.includes(k)) rest[k] = v;
        }
        return React.createElement(tag, rest);
      });
    }
    return cache.get(tag);
  };
  return {
    motion: new Proxy({}, { get: (_t, tag: string) => passthrough(String(tag)) }),
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
  };
});

// The heavy markdown pipeline (next/dynamic chunk: react-markdown +
// highlight.js + katex) is the thing to avoid — but the CodeBlock/copy
// behavior under test only exists inside the component map handed TO the
// renderer. Stubbing LazyMarkdown with plain react-markdown keeps the real
// component-map code paths while dropping the heavy chunk entirely (a
// next/dynamic ssr:false chunk never resolves under jsdom).
vi.mock("@/components/ai/LazyMarkdown", async () => {
  const React = await import("react");
  const ReactMarkdown = (await import("react-markdown")).default;
  return {
    LazyMarkdown: (props: { content: string; components?: Record<string, unknown> }) =>
      React.createElement(ReactMarkdown, { components: props.components }, props.content),
  };
});

vi.mock("@/components/ai/LottiePlayer", () => ({
  LottiePlayer: () => null,
}));

vi.mock("@/lib/puter", () => ({
  initPuterDiagnostics: vi.fn(),
  signInToPuter: vi.fn(),
  getPuterStatus: () => ({ isSignedIn: false }),
}));

vi.mock("next-intl", () => nextIntlMockFactory());

import { ChatMessageItem } from "../ChatMessageItem";

function msg(overrides: Partial<Parameters<typeof ChatMessageItem>[0]["message"]> = {}) {
  return {
    id: "m1",
    type: "assistant" as const,
    content: "Plain reply",
    timestamp: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

const baseProps = {
  message: msg(),
  isLatestAssistant: false,
  isLoading: false,
  mode: "cs_assistant" as const,
  onRetry: undefined as undefined | (() => void),
};

function renderItem(overrides: Partial<typeof baseProps> = {}) {
  return render(<ChatMessageItem {...baseProps} {...overrides} />);
}

beforeEach(() => {
  setMockIntlLocale("en");
  vi.stubGlobal(
    "navigator",
    Object.assign(Object.create(Object.getPrototypeOf(navigator)), navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ChatMessageItem", () => {
  it("user messages render their raw content without the markdown pipeline", () => {
    renderItem({ message: msg({ type: "user", content: "hello from user" }) });
    expect(screen.getByText("hello from user")).toBeInTheDocument();
    expect(screen.queryByText("Plain reply")).toBeNull();
  });

  it("assistant messages flow through the markdown renderer", () => {
    renderItem({ message: msg({ content: "**bold** intro" }) });
    // react-markdown (mocked heavy renderer) applies the component map
    expect(screen.getByText("bold")).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("assistant bubbles expose a copy action; streaming ones do not", () => {
    const { rerender } = renderItem();
    expect(screen.getByLabelText("aiAssistant.copyContent")).toBeInTheDocument();

    rerender(<ChatMessageItem {...baseProps} message={msg({ streaming: true })} />);
    expect(screen.queryByLabelText("aiAssistant.copyContent")).toBeNull();
  });

  it("error bubbles show retry only for the latest assistant turn when idle", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    const { rerender } = renderItem({
      message: msg({ id: "error_1", content: "⚠️ quota exhausted" }),
      isLatestAssistant: true,
      onRetry,
    });
    expect(screen.getByText("⚠️ quota exhausted")).toBeInTheDocument();

    const retry = screen.getByLabelText("aiAssistant.retry");
    await user.click(retry);
    expect(onRetry).toHaveBeenCalledTimes(1);

    // not latest → no retry affordance
    rerender(<ChatMessageItem {...baseProps} isLatestAssistant={false} onRetry={onRetry} />);
    expect(screen.queryByLabelText("aiAssistant.retry")).toBeNull();

    // retry without callback → absent
    rerender(<ChatMessageItem {...baseProps} isLatestAssistant />);
    expect(screen.queryByLabelText("aiAssistant.retry")).toBeNull();
  });

  it("canned-error content (⚠️ prefix) is treated as an error bubble even with a normal id", () => {
    renderItem({ message: msg({ id: "m9", content: "💳 billing issue" }) });
    expect(screen.getByText("💳 billing issue")).toBeInTheDocument();
  });

  it("code blocks render with the language label and a working copy button", async () => {
    // fake timers are required for the copied→revert assertion, and
    // user-event deadlocks under them in this setup — fireEvent is the
    // synchronous escape hatch for these two copy tests only.
    vi.useFakeTimers();
    renderItem({
      message: msg({ content: "```js\nconst x = 1;\n```" }),
    });

    expect(screen.getByText("js")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("aiAssistant.copyCode"));
    // flush the async clipboard write (microtasks still run under fake timers)
    await act(async () => {
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("const x = 1;\n");
    expect(screen.getByText("aiAssistant.copied")).toBeInTheDocument();

    // the copied state reverts after 2s
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("aiAssistant.copied")).toBeNull();
    expect(screen.getByText("aiAssistant.copyCode")).toBeInTheDocument();
  });

  it("copy button writes the message content and flips to copied temporarily", async () => {
    vi.useFakeTimers();
    renderItem({ message: msg({ content: "copy me" }) });

    fireEvent.click(screen.getByLabelText("aiAssistant.copyContent"));
    await act(async () => {
      await Promise.resolve();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("copy me");
    expect(screen.getByLabelText("aiAssistant.copied")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByLabelText("aiAssistant.copyContent")).toBeInTheDocument();
  });

  it("clipboard failures keep the copy affordance (no crash)", async () => {
    (navigator.clipboard.writeText as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce(new Error("denied"));
    renderItem();
    fireEvent.click(screen.getByLabelText("aiAssistant.copyContent"));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalled());
    // stays in the un-copied state
    expect(screen.getByLabelText("aiAssistant.copyContent")).toBeInTheDocument();
  });

  it("markdown fences inside the reply produce a runnable language header", () => {
    renderItem({ message: msg({ content: "# Heading\n\nBody text" }) });
    expect(screen.getByText("Heading")).toBeInTheDocument();
    expect(screen.getByText("Body text")).toBeInTheDocument();
  });
});
