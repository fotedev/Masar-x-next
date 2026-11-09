import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef } from "react";
import { setMockIntlLocale, nextIntlMockFactory } from "@/test/mocks/next-intl";

// framer-motion passthrough: keeps the DOM tree identical without animation
// timings, so menu open/close assertions are deterministic under jsdom.
// Components are cached per tag — a fresh component identity per access would
// remount the subtree on every render and detach captured element refs.
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const FRAMER_PROPS = [
    "initial", "animate", "exit", "transition", "variants",
    "whileHover", "whileTap", "whileDrag", "whileFocus", "whileInView",
    "layout", "layoutId", "drag", "dragConstraints",
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
  const AnimatePresence = ({ children }: { children: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    motion: new Proxy({}, { get: (_t, tag: string) => passthrough(String(tag)) }),
    AnimatePresence,
  };
});

vi.mock("@/components/ai/QuickQuizFromTextModal", () => ({
  QuickQuizFromTextModal: () => null,
}));
vi.mock("@/components/ai/QuickQuizPlayerModal", () => ({
  QuickQuizPlayerModal: () => null,
}));

vi.mock("next-intl", () => nextIntlMockFactory());

import { ChatInput } from "../ChatInput";
import type { PastedAttachment } from "@/lib/ai/pasted-attachments";

const t = (key: string) => key;

// Cast through the component's own prop type: vi.fn() mocks and the nullable
// createRef don't line up with the exact prop signatures, but the runtime
// contract is what these tests exercise.
const baseProps = {
  inputMessage: "",
  setInputMessage: vi.fn(),
  isLoading: false,
  onSendMessage: vi.fn(),
  inputRef: createRef<HTMLTextAreaElement>(),
  t,
  isInitialState: false,
  user: null,
  mode: "cs_assistant" as const,
  setMode: vi.fn(),
  selectedModel: "gpt-5-nano",
  setSelectedModel: vi.fn(),
  onSummarizeChat: vi.fn(),
  onClearChat: vi.fn(),
  isSummarizing: false,
  hasChatData: false,
  onOpenPuterSettings: vi.fn(),
  pastedAttachments: [] as PastedAttachment[],
  onAddPastedText: vi.fn(),
  onRemoveAttachment: vi.fn(),
} as unknown as Parameters<typeof ChatInput>[0];

type ChatInputOverrides = Partial<typeof baseProps>;

const chip: PastedAttachment = {
  id: "p1",
  name: "pasted-text-1.txt",
  content: "x".repeat(5000),
  charCount: 5000,
  sizeLabel: "5.0 KB",
};

function renderInput(overrides: ChatInputOverrides = {}) {
  return render(<ChatInput {...baseProps} {...overrides} />);
}

beforeEach(() => {
  setMockIntlLocale("en");
  vi.clearAllMocks();
});

describe("ChatInput", () => {
  it("Enter sends; Shift+Enter inserts a newline instead", async () => {
    const user = userEvent.setup();
    renderInput({ inputMessage: "hello" });
    const textarea = screen.getByRole("textbox");

    await user.type(textarea, "{Enter}");
    expect(baseProps.onSendMessage).toHaveBeenCalledTimes(1);

    await user.type(textarea, "{Shift>}{Enter}{/Shift}");
    expect(baseProps.onSendMessage).toHaveBeenCalledTimes(1);
  });

  it("send is gated on a non-empty message and not loading", async () => {
    const user = userEvent.setup();
    const { rerender } = renderInput();
    expect(screen.getByRole("button", { name: "send" })).toBeDisabled();

    rerender(<ChatInput {...baseProps} inputMessage="hi" />);
    const send = screen.getByRole("button", { name: "send" });
    expect(send).toBeEnabled();
    await user.click(send);
    expect(baseProps.onSendMessage).toHaveBeenCalledTimes(1);

    rerender(<ChatInput {...baseProps} inputMessage="hi" isLoading />);
    expect(screen.getByRole("button", { name: "send" })).toBeDisabled();
  });

  it("attachments alone enable send even with an empty input", () => {
    renderInput({ pastedAttachments: [chip] });
    expect(screen.getByRole("button", { name: "send" })).toBeEnabled();
  });

  it("small pastes fall through untouched", () => {
    renderInput({ inputMessage: "" });
    const textarea = screen.getByRole("textbox");
    fireEvent.paste(textarea, { clipboardData: { getData: () => "just a line" } });
    expect(baseProps.onAddPastedText).not.toHaveBeenCalled();
  });

  it("large pastes (>15 lines) become attachment chips via onAddPastedText", () => {
    renderInput();
    const textarea = screen.getByRole("textbox");
    const big = Array.from({ length: 20 }, (_, i) => `line ${i}`).join("\n");
    fireEvent.paste(textarea, { clipboardData: { getData: () => big } });
    expect(baseProps.onAddPastedText).toHaveBeenCalledWith(big);
  });

  it("renders attachment chips with size and a working remove button", async () => {
    const user = userEvent.setup();
    renderInput({ pastedAttachments: [chip] });
    expect(screen.getByText("pastedText")).toBeInTheDocument();
    expect(screen.getByText(/5\.0 KB/)).toBeInTheDocument();
    expect(screen.getByText(/5000/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "removeAttachment" }));
    expect(baseProps.onRemoveAttachment).toHaveBeenCalledWith("p1");
  });

  it("tools menu opens, persona selection calls setMode, menu closes", async () => {
    const user = userEvent.setup();
    renderInput();
    const tools = screen.getByRole("button", { name: "tools" });
    expect(tools).toHaveAttribute("aria-expanded", "false");

    await user.click(tools);
    expect(tools).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("quickQuizFromText")).toBeInTheDocument();

    await user.click(screen.getByText("assistantPersona"));
    await user.click(screen.getByText("assistantStudent"));
    expect(baseProps.setMode).toHaveBeenCalledWith("student_agent");
    expect(tools).toHaveAttribute("aria-expanded", "false");
  });

  it("summarize is disabled without chat data and fires when enabled", async () => {
    const user = userEvent.setup();
    const { rerender } = renderInput({ hasChatData: false });

    await user.click(screen.getByRole("button", { name: "tools" }));
    const summarize = screen.getByRole("button", { name: "summarizeCsChat" });
    expect(summarize).toBeDisabled();

    // rerender keeps the internal menu state OPEN — the same button is
    // re-queried and is now enabled once hasChatData flips true.
    rerender(<ChatInput {...baseProps} hasChatData />);
    const enabled = screen.getByRole("button", { name: "summarizeCsChat" });
    expect(enabled).toBeEnabled();
    await user.click(enabled);
    expect(baseProps.onSummarizeChat).toHaveBeenCalledTimes(1);
  });

  it("clear chat and puter settings are wired", async () => {
    const user = userEvent.setup();
    renderInput({ hasChatData: true });
    await user.click(screen.getByRole("button", { name: "tools" }));
    await user.click(screen.getByRole("button", { name: "clearChat" }));
    expect(baseProps.onClearChat).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "tools" }));
    await user.click(screen.getByRole("button", { name: "puterSettings" }));
    expect(baseProps.onOpenPuterSettings).toHaveBeenCalledTimes(1);
  });

  it("Escape dismisses the open tools menu", async () => {
    const user = userEvent.setup();
    renderInput();
    const tools = screen.getByRole("button", { name: "tools" });
    await user.click(tools);
    expect(tools).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(tools).toHaveAttribute("aria-expanded", "false"));
  });

  it("pointerdown outside the menus dismisses them, inside keeps them", async () => {
    const user = userEvent.setup();
    renderInput();
    const tools = screen.getByRole("button", { name: "tools" });
    const model = screen.getByRole("button", { name: "model" });
    await user.click(tools);
    await user.click(model);
    expect(model).toHaveAttribute("aria-expanded", "true");

    // pointerdown inside a menu wrap (the tools trigger itself) → stay open
    tools.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    expect(model).toHaveAttribute("aria-expanded", "true");

    // pointerdown elsewhere (document body) → both close; the native
    // document listener schedules a React update, so assert via waitFor
    document.body.dispatchEvent(new Event("pointerdown", { bubbles: true }));
    await waitFor(() => expect(tools).toHaveAttribute("aria-expanded", "false"));
    expect(model).toHaveAttribute("aria-expanded", "false");
  });

  it("model pill opens, selecting a model calls setSelectedModel and closes", async () => {
    const user = userEvent.setup();
    renderInput({ selectedModel: "gpt-5-nano" });
    const pill = screen.getByRole("button", { name: "model" });
    await user.click(pill);
    expect(pill).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Claude 4.6 Sonnet")).toBeInTheDocument();

    await user.click(screen.getByText("o1-mini"));
    expect(baseProps.setSelectedModel).toHaveBeenCalledWith("o1-mini");
    expect(pill).toHaveAttribute("aria-expanded", "false");
  });

  it("placeholder switches to the Arabic variant for Arabic content", () => {
    const { rerender } = renderInput({ inputMessage: "" });
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "inputPlaceholder");

    rerender(<ChatInput {...baseProps} inputMessage="مرحبا" />);
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "inputPlaceholderAr");
  });
});
