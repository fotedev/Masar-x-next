import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getRepoStars } from "../github-stars";

// Spec 054 — getRepoStars mirrors the github-releases.ts fetch pattern
// (stubbed global fetch) but must NEVER throw: every failure degrades to
// null so the footer renders the plain star link (graceful fallback).

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const jsonResponse = (body: unknown, ok = true, status = 200) => ({
  ok,
  status,
  json: async () => body,
});

// AbortSignal.timeout(2500) creates a fresh instance per call, so the
// exact-args assertion matches it asymmetrically.
const EXPECTED_CALL = [
  "https://api.github.com/repos/Masar-X/Masar-x",
  {
    headers: { Accept: "application/vnd.github+json" },
    next: { revalidate: 3600 },
    signal: expect.any(AbortSignal),
  },
] as const;

describe("getRepoStars — happy path", () => {
  it("returns stargazers_count with the cached-fetch call shape", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ stargazers_count: 28 }));

    await expect(getRepoStars()).resolves.toBe(28);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(...EXPECTED_CALL);
  });

  it("returns 0 as a real count (not a fallback)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ stargazers_count: 0 }));
    await expect(getRepoStars()).resolves.toBe(0);
  });
});

describe("getRepoStars — every failure degrades to null (never throws)", () => {
  it("returns null on non-OK responses (rate limited 403)", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ message: "API rate limit exceeded" }, false, 403),
    );
    await expect(getRepoStars()).resolves.toBeNull();
  });

  it("returns null when stargazers_count is missing or non-numeric", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await expect(getRepoStars()).resolves.toBeNull();

    fetchMock.mockResolvedValueOnce(jsonResponse({ stargazers_count: "many" }));
    await expect(getRepoStars()).resolves.toBeNull();
  });

  it("returns null when the body is not JSON (json() throws)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new Error("invalid json");
      },
    });
    await expect(getRepoStars()).resolves.toBeNull();
  });

  it("returns null when fetch rejects (offline / network error)", async () => {
    fetchMock.mockRejectedValueOnce(new Error("network down"));
    await expect(getRepoStars()).resolves.toBeNull();
  });

  it("returns null on abort (AbortSignal.timeout fires)", async () => {
    fetchMock.mockRejectedValueOnce(
      new DOMException("The operation was timed out", "TimeoutError"),
    );
    await expect(getRepoStars()).resolves.toBeNull();
  });
});
