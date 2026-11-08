import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Contract test for the desktop loopback Host guard (spec 041 R18):
 * only in desktop mode (MASARX_DESKTOP_LOOPBACK=1) must non-loopback
 * Host headers be rejected, and a missing Host must fail closed.
 */

// The factory is hoisted above this file's declarations — define the double
// inside it (vi.mock factories cannot reference top-level variables).
vi.mock("next/server", () => {
  class FakeNextResponse {
    static next() {
      return { kind: "next" };
    }
    status?: number;
    constructor(
      public body?: unknown,
      public init?: { status?: number },
    ) {
      this.status = init?.status;
    }
  }
  return { NextResponse: FakeNextResponse };
});

import { middleware } from "../middleware";

type Req = Parameters<typeof middleware>[0];

const reqWithHost = (host: string | null): Req =>
  ({
    headers: { get: (key: string) => (key === "host" ? host : null) },
  }) as unknown as Req;

afterEach(() => {
  delete process.env.MASARX_DESKTOP_LOOPBACK;
});

describe("desktop loopback Host guard (R18, spec 041)", () => {
  it("passes everything through when not in desktop mode", () => {
    expect(middleware(reqWithHost("attacker.example"))).toEqual({ kind: "next" });
  });

  it("accepts loopback hosts in desktop mode", () => {
    process.env.MASARX_DESKTOP_LOOPBACK = "1";
    expect(middleware(reqWithHost("127.0.0.1:43110"))).toEqual({ kind: "next" });
    expect(middleware(reqWithHost("localhost:43110"))).toEqual({ kind: "next" });
    expect(middleware(reqWithHost("[::1]:43110"))).toEqual({ kind: "next" });
  });

  it("rejects non-loopback hosts with 403 in desktop mode", () => {
    process.env.MASARX_DESKTOP_LOOPBACK = "1";
    const res = middleware(reqWithHost("attacker.example")) as { status?: number };
    expect(res).not.toEqual({ kind: "next" });
    expect(res.status).toBe(403);
  });

  it("fails closed when the Host header is missing in desktop mode", () => {
    process.env.MASARX_DESKTOP_LOOPBACK = "1";
    const res = middleware(reqWithHost(null)) as { status?: number };
    expect(res).not.toEqual({ kind: "next" });
    expect(res.status).toBe(403);
  });
});
