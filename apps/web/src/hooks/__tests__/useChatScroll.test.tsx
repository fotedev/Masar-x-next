// Spec 049 CI surfacing — the chat scroll grace window (useChatScroll).
// Simulates Chrome's anchoring-before-ResizeObserver delivery order: the
// scroll event for a reflow arrives BEFORE the RO callback for the same
// reflow, flipping the measured distance. Without the grace window the open
// view strands (the CI prod e2e failure: chat opens ~568px above the newest
// message with the jump pill up); with it the view re-pins until real user
// intent.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { useChatScroll } from "../useChatScroll";

interface FakeRO {
  callback: (entries: unknown[]) => void;
  observed: Element[];
  fire: () => void;
}

let roInstances: FakeRO[];
let scrollToMock: ReturnType<typeof vi.fn>;
let originalScrollTo: PropertyDescriptor | undefined;

class FakeResizeObserver {
  callback: (entries: unknown[]) => void;
  observed: Element[] = [];
  constructor(cb: (entries: unknown[]) => void) {
    this.callback = cb;
    roInstances.push(this);
  }
  observe(el: Element) {
    this.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.observed = [];
  }
  fire() {
    this.callback([]);
  }
}

function Harness({ messages }: { messages: readonly unknown[] }) {
  const { containerRef } = useChatScroll(messages);
  return (
    <div ref={containerRef} data-testid="scroller">
      <div data-testid="content" />
    </div>
  );
}

const setMetrics = (
  el: HTMLElement,
  scrollHeight: number,
  clientHeight: number,
  scrollTop: number,
) => {
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(el, "scrollTop", { configurable: true, value: scrollTop });
};

const fireScroll = (el: HTMLElement) => el.dispatchEvent(new Event("scroll"));

beforeEach(() => {
  roInstances = [];
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  scrollToMock = vi.fn();
  originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollTo");
  Object.defineProperty(HTMLElement.prototype, "scrollTo", {
    configurable: true,
    writable: true,
    value: scrollToMock,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalScrollTo) {
    Object.defineProperty(HTMLElement.prototype, "scrollTo", originalScrollTo);
  }
});

describe("useChatScroll grace window (spec 049)", () => {
  it("re-pins after an anchoring flip during the open grace window", () => {
    const { getByTestId, rerender } = render(<Harness messages={[]} />);
    const el = getByTestId("scroller") as HTMLElement;
    setMetrics(el, 600, 600, 0); // short content; the one-shot stick lands at top

    // History sync: messages arrive → stick effect fires.
    rerender(<Harness messages={["m1"]} />);
    expect(scrollToMock).toHaveBeenCalledTimes(1);

    // Markdown chunk mounts: content explodes; the anchoring scroll event
    // is delivered BEFORE the RO callback for the same reflow.
    setMetrics(el, 5200, 600, 4032); // 568px above the new bottom (4600)
    fireScroll(el); // measure() flips isNearBottom false
    const callsBeforeRo = scrollToMock.mock.calls.length;
    roInstances[roInstances.length - 1]!.fire();

    // The grace window re-pins despite the flipped distance.
    expect(scrollToMock.mock.calls.length).toBeGreaterThan(callsBeforeRo);
    expect(scrollToMock).toHaveBeenLastCalledWith({ top: 5200, behavior: "instant" });
  });

  it("grace ends on wheel — a resize no longer re-pins a scrolled-away view", () => {
    const { getByTestId, rerender } = render(<Harness messages={[]} />);
    const el = getByTestId("scroller") as HTMLElement;
    setMetrics(el, 600, 600, 0);
    rerender(<Harness messages={["m1"]} />);

    // Flip + fire while still in grace (re-pins).
    setMetrics(el, 5200, 600, 4032);
    fireScroll(el);
    roInstances[roInstances.length - 1]!.fire();

    // The user wheels and scrolls away: grace ends, measure flips near=false.
    el.dispatchEvent(new Event("wheel"));
    setMetrics(el, 5200, 600, 1000); // upward move (4032 → 1000)
    fireScroll(el);
    const callsAfterGrace = scrollToMock.mock.calls.length;

    // Further growth above the viewport: no re-pin anymore.
    setMetrics(el, 5600, 600, 1000);
    roInstances[roInstances.length - 1]!.fire();
    expect(scrollToMock.mock.calls.length).toBe(callsAfterGrace);
  });

  it("grace ends on an upward scroll (navigation / loadOlder jump)", () => {
    const { getByTestId, rerender } = render(<Harness messages={[]} />);
    const el = getByTestId("scroller") as HTMLElement;
    setMetrics(el, 5200, 600, 4600); // pinned at the bottom of tall content
    rerender(<Harness messages={["m1"]} />);
    fireScroll(el); // records lastScrollTop = 4600 (downward move from 0)

    // Programmatic jump to the top (loadOlder): upward → grace ends.
    setMetrics(el, 5200, 600, 0);
    fireScroll(el);
    const callsBeforeRo = scrollToMock.mock.calls.length;
    roInstances[roInstances.length - 1]!.fire();
    expect(scrollToMock.mock.calls.length).toBe(callsBeforeRo);
  });

  it("near-bottom re-pin still applies after the grace window ended", () => {
    const { getByTestId, rerender } = render(<Harness messages={[]} />);
    const el = getByTestId("scroller") as HTMLElement;
    setMetrics(el, 5200, 600, 4600);
    rerender(<Harness messages={["m1"]} />);
    fireScroll(el);

    el.dispatchEvent(new Event("wheel")); // grace ends
    // Content settles back near the bottom (distance ≤ threshold).
    setMetrics(el, 5200, 600, 4550); // distance = 50
    fireScroll(el); // measure → near = true
    const callsBeforeRo = scrollToMock.mock.calls.length;
    roInstances[roInstances.length - 1]!.fire();
    expect(scrollToMock.mock.calls.length).toBeGreaterThan(callsBeforeRo);
  });

  it("observes both the content child and the scroller itself", () => {
    const { getByTestId, rerender } = render(<Harness messages={[]} />);
    const el = getByTestId("scroller") as HTMLElement;
    rerender(<Harness messages={["m1"]} />);
    const ro = roInstances[roInstances.length - 1]!;
    expect(ro.observed).toContain(el);
    expect(ro.observed).toContain(getByTestId("content"));
  });
});
