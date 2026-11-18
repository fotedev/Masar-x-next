// Spec 051 — ConversationHistoryDrawer (narrow-viewport counterpart) unit
// tests: portal rendering, Escape/containment dismissal, guest boundary,
// close-on-selection, scroll lock.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
// The factory import MUST precede the component import: when next-intl's
// mock factory runs (during the component's evaluation) the binding must
// already be initialized (same ordering as ZaneStatusAvatar.test.tsx).
import { nextIntlMockFactory } from "@/test/mocks/next-intl";
import type { Conversation } from "@/types/database";
import { ConversationHistoryDrawer } from "../ConversationHistoryDrawer";

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("@/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));
vi.mock("next-intl", () => nextIntlMockFactory());

// ZaneAvatar (header child) auto-plays the active clip on mount.
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(window.HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
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
  open: true,
  onClose: vi.fn(),
  conversations: [mkConv(1), mkConv(2)],
  activeId: "c-1",
  loading: false,
  hasMore: false,
  loadMore: vi.fn(),
  refresh: vi.fn(),
  onSwitch: vi.fn(),
  onDelete: vi.fn(),
  onNewChat: vi.fn(),
  status: "idle" as const,
  isSignedIn: true,
};

describe("ConversationHistoryDrawer (spec 051)", () => {
  it("renders nothing while closed and before the first open", () => {
    const { container } = render(<ConversationHistoryDrawer {...baseProps} open={false} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it("portals an end-side dialog hosting the same conversation list", () => {
    render(<ConversationHistoryDrawer {...baseProps} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog.className).toContain("end-0");
    expect(dialog.className).toContain("border-s");
    expect(screen.getByText("Conversation 1")).toBeInTheDocument();
    expect(screen.getByText("aiAssistant.assistantName")).toBeInTheDocument();
    // New chat + close controls live in the drawer header.
    expect(screen.getByRole("button", { name: "aiAssistant.newChat" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "aiAssistant.close" })).toBeInTheDocument();
  });

  it("Escape closes the drawer", () => {
    const onClose = vi.fn();
    render(<ConversationHistoryDrawer {...baseProps} onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("a pointerdown outside the panel closes it; inside does not", () => {
    const onClose = vi.fn();
    const { container } = render(<ConversationHistoryDrawer {...baseProps} onClose={onClose} />);
    const dialog = screen.getByRole("dialog");
    // Inside the panel: no dismissal.
    fireEvent.pointerDown(dialog);
    expect(onClose).not.toHaveBeenCalled();
    // Backdrop / outside: dismissal.
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
    // (baseElement is empty — the drawer portals to document.body.)
    expect(container).toBeEmptyDOMElement();
  });

  it("guests see the sign-in affordance instead of the list", async () => {
    render(<ConversationHistoryDrawer {...baseProps} isSignedIn={false} />);
    expect(screen.getByTestId("conversation-list-guest")).toBeInTheDocument();
    expect(screen.queryByText("Conversation 1")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("aiAssistant.signInToSeeHistory"));
    expect(pushMock).toHaveBeenCalledWith("/login");
  });

  it("selecting a conversation switches and closes the drawer", async () => {
    const onClose = vi.fn();
    const onSwitch = vi.fn().mockResolvedValue(undefined);
    render(<ConversationHistoryDrawer {...baseProps} onClose={onClose} onSwitch={onSwitch} />);
    fireEvent.click(screen.getByRole("button", { name: /Conversation 2/ }));
    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith("c-2"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("locks body scroll while open and restores it on close", () => {
    const { rerender, unmount } = render(<ConversationHistoryDrawer {...baseProps} />);
    expect(document.body.style.overflow).toBe("hidden");
    rerender(<ConversationHistoryDrawer {...baseProps} open={false} />);
    expect(document.body.style.overflow).not.toBe("hidden");
    unmount();
  });
});
