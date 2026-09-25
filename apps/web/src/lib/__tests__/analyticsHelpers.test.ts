import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("../supabase", () => ({
  supabase: { rpc: rpcMock },
}));

import { analyticsHelpers } from "../analyticsHelpers";

describe("analyticsHelpers.getAdminAnalyticsSummary", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("maps the RPC unauthorized error to the unauthorized UI state", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "unauthorized" },
    });

    await expect(analyticsHelpers.getAdminAnalyticsSummary()).resolves.toEqual({
      data: null,
      error: "unauthorized",
    });
  });

  it("maps other RPC errors to the load-failed UI state", async () => {
    rpcMock.mockResolvedValue({
      data: null,
      error: { message: "statement timeout" },
    });

    await expect(analyticsHelpers.getAdminAnalyticsSummary()).resolves.toEqual({
      data: null,
      error: "load_failed",
    });
  });

  it("returns the unchanged admin JSON payload", async () => {
    const payload = {
      totalUsers: 1,
      totalMessages: 2,
      totalViews: 3,
      totalClicks: 4,
      topContentTypes: [],
      recentActivity: [],
    };
    rpcMock.mockResolvedValue({ data: payload, error: null });

    await expect(analyticsHelpers.getAdminAnalyticsSummary()).resolves.toEqual({
      data: payload,
      error: null,
    });
  });
});
