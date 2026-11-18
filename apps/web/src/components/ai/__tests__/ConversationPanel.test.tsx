// Spec 051 — ConversationPanel / ConversationList unit tests. Pure
// presentational: state + actions arrive as props, so no hook mocking —
// only next-intl (namespace echo), confirmToast, and the router.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
// The factory import MUST precede the component import: when next-intl's
// mock factory runs (during the component's evaluation) the binding must
// already be initialized (same ordering as ZaneStatusAvatar.test.tsx).
import { nextIntlMockFactory } from "@/test/mocks/next-intl";
import type { Conversation } from "@/types/database";
import { ConversationList, ConversationPanel } from "../ConversationPanel";

const { confirmToastMock, pushMock } = vi.hoisted(() => ({
  confirmToastMock: vi.fn(),
  pushMock: vi.fn(),
}));

vi.mock("@/lib/confirmToast", () => ({ confirmToast: confirmToastMock }));
vi.mock("@/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("framer-motion", () => ({ useReducedMotion: () => false }));
vi.mock("next-intl", () => nextIntlMockFactory());

// ZaneAvatar mounts crossfading <video> elements — stub playback like
// ZaneStatusAvatar.test.tsx.
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => Promise.resolve());
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mkConv = (i: number, over: Partial<Conversation> = {}): Conversation =>
  ({
    id: `c-${i}`,
    user_id: "u-1",
    mode: "cs_assistant",
    title: `Conversation ${i}`,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
    ...over,
  }) as Conversation;

const baseProps = {
  conversations: [mkConv(1), mkConv(2), mkConv(3, { title: null })],
  activeId: "c-1",
  loading: false,
  hasMore: false,
  loadMore: vi.fn(),
  onSwitch: vi.fn(),
  onDelete: vi.fn(),
  isSignedIn: true,
};

describe("ConversationList", () => {
  it("renders rows with the noTitle fallback for untitled conversations", () => {
    render(<ConversationList {...baseProps} />);
    expect(screen.getByText("Conversation 1")).toBeInTheDocument();
    expect(screen.getByText("aiAssistant.noTitle")).toBeInTheDocument();
  });

  it("highlights the active conversation via aria-current", () => {
    render(<ConversationList {...baseProps} />);
    const active = screen.getByRole("button", { name: /Conversation 1/ });
    expect(active).toHaveAttribute("aria-current", "true");
    const inactive = screen.getByRole("button", { name: /Conversation 2/ });
    expect(inactive).not.toHaveAttribute("aria-current");
  });

  it("clicking a row switches to that conversation", async () => {
    const onSwitch = vi.fn();
    render(<ConversationList {...baseProps} onSwitch={onSwitch} />);
    fireEvent.click(screen.getByRole("button", { name: /Conversation 2/ }));
    expect(onSwitch).toHaveBeenCalledWith("c-2");
  });

  it("delete asks for confirmation and deletes on confirm", async () => {
    confirmToastMock.mockResolvedValue(true);
    const onDelete = vi.fn();
    render(<ConversationList {...baseProps} onDelete={onDelete} />);
    fireEvent.click(screen.getAllByRole("button", { name: "aiAssistant.deleteConversation" })[0]);
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledWith("c-1"));
    expect(confirmToastMock).toHaveBeenCalledWith("aiAssistant.deleteConversationConfirm", {
      confirmLabel: "common.confirm",
      cancelLabel: "common.cancel",
    });
  });

  it("delete cancels without deleting on dismiss", async () => {
    confirmToastMock.mockResolvedValue(false);
    const onDelete = vi.fn();
    render(<ConversationList {...baseProps} onDelete={onDelete} />);
    fireEvent.click(screen.getAllByRole("button", { name: "aiAssistant.deleteConversation" })[0]);
    await vi.waitFor(() => expect(confirmToastMock).toHaveBeenCalled());
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("shows skeleton rows while loading an empty list", () => {
    render(<ConversationList {...baseProps} conversations={[]} loading />);
    expect(screen.getByTestId("conversation-list-loading")).toBeInTheDocument();
    expect(screen.getByText("aiAssistant.loadingConversations")).toBeInTheDocument();
  });

  it("shows the empty hint when signed in with no conversations", () => {
    render(<ConversationList {...baseProps} conversations={[]} />);
    expect(screen.getByTestId("conversation-list-empty")).toBeInTheDocument();
    expect(screen.getByText("aiAssistant.noConversations")).toBeInTheDocument();
  });

  it("guests see only the sign-in affordance pointing at /login", async () => {
    render(<ConversationList {...baseProps} isSignedIn={false} />);
    expect(screen.getByTestId("conversation-list-guest")).toBeInTheDocument();
    expect(screen.queryByTestId("conversation-list")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("aiAssistant.signInToSeeHistory"));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("loadMore fires when the list scroller approaches its end", () => {
    const loadMore = vi.fn();
    render(<ConversationList {...baseProps} loadMore={loadMore} hasMore />);
    const list = screen.getByTestId("conversation-list");
    Object.defineProperty(list, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 500, configurable: true });
    // Far from the end: no fetch.
    Object.defineProperty(list, "scrollTop", { value: 0, configurable: true });
    fireEvent.scroll(list);
    expect(loadMore).not.toHaveBeenCalled();
    // Within 96px of the end: fetch.
    Object.defineProperty(list, "scrollTop", { value: 450, configurable: true });
    fireEvent.scroll(list);
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it("loadMore is gated by hasMore and the loading flag", () => {
    const loadMore = vi.fn();
    render(<ConversationList {...baseProps} loadMore={loadMore} hasMore={false} />);
    const list = screen.getByTestId("conversation-list");
    Object.defineProperty(list, "scrollHeight", { value: 1000, configurable: true });
    Object.defineProperty(list, "clientHeight", { value: 500, configurable: true });
    Object.defineProperty(list, "scrollTop", { value: 450, configurable: true });
    fireEvent.scroll(list);
    expect(loadMore).not.toHaveBeenCalled();
  });
});

describe("ConversationPanel", () => {
  const panelProps = {
    ...baseProps,
    refresh: vi.fn(),
    onNewChat: vi.fn(),
    status: "idle" as const,
  };

  it("renders the desktop shell: aside hidden below lg, end-side border, fixed width", () => {
    const { container } = render(<ConversationPanel {...panelProps} />);
    const aside = container.querySelector('aside[data-testid="conversation-panel"]');
    expect(aside).not.toBeNull();
    expect(aside?.className).toContain("hidden");
    expect(aside?.className).toContain("lg:flex");
    expect(aside?.className).toContain("lg:w-72");
    expect(aside?.className).toContain("border-s");
  });

  it("renders the avatar home header (name + status) once", () => {
    render(<ConversationPanel {...panelProps} />);
    expect(screen.getByText("aiAssistant.assistantName")).toBeInTheDocument();
    expect(screen.getByText("aiAssistant.statusConnected")).toBeInTheDocument();
  });

  it("new chat resets the transcript then refreshes the list", async () => {
    const onNewChat = vi.fn();
    const refresh = vi.fn();
    render(<ConversationPanel {...panelProps} onNewChat={onNewChat} refresh={refresh} />);
    fireEvent.click(screen.getByRole("button", { name: "aiAssistant.newChat" }));
    await vi.waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(onNewChat).toHaveBeenCalled();
  });
});
