import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

const { membershipState } = vi.hoisted(() => ({
  membershipState: { data: undefined as unknown, isLoading: true },
}));

vi.mock("@/hooks/trw/useTRWMembership", () => ({
  default: () => membershipState,
}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/ar/non-academic",
}));

import { TRWAccessGate } from "../trw/TRWAccessGate";

beforeEach(() => {
  membershipState.data = undefined;
  membershipState.isLoading = true;
});

describe("TRWAccessGate", () => {
  it("shows a loading state while membership resolves", () => {
    render(
      <TRWAccessGate>
        <div>SECRET</div>
      </TRWAccessGate>,
    );
    expect(screen.getByText(/Verifying TRW membership/i)).toBeDefined();
    expect(screen.queryByText("SECRET")).toBeNull();
  });

  it("hides children and shows the redeem gate for non-members", async () => {
    membershipState.isLoading = false;
    membershipState.data = null;
    render(
      <TRWAccessGate>
        <div>SECRET</div>
      </TRWAccessGate>,
    );
    await waitFor(() => expect(screen.getByText(/Access Required/)).toBeDefined());
    expect(screen.queryByText("SECRET")).toBeNull();
    expect(screen.getByText(/Redeem Access Code/)).toBeDefined();
    // locale-aware links from the /ar path
    const redeem = screen.getByText(/Redeem Access Code/).closest("a");
    expect(redeem?.getAttribute("href")).toBe("/ar/trw/redeem");
  });

  it("renders the custom fallback when provided", () => {
    membershipState.isLoading = false;
    membershipState.data = null;
    render(
      <TRWAccessGate fallback={<div>CUSTOM FALLBACK</div>}>
        <div>SECRET</div>
      </TRWAccessGate>,
    );
    expect(screen.getByText("CUSTOM FALLBACK")).toBeDefined();
    expect(screen.queryByText(/Access Required/)).toBeNull();
  });

  it("renders children for active members", () => {
    membershipState.isLoading = false;
    membershipState.data = { id: "m1" };
    render(
      <TRWAccessGate>
        <div>SECRET</div>
      </TRWAccessGate>,
    );
    expect(screen.getByText("SECRET")).toBeDefined();
    expect(screen.queryByText(/Access Required/)).toBeNull();
  });
});
