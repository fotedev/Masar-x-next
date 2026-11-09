import { afterEach, describe, expect, it } from "vitest";
import { isDesktopHostForbidden, isLocalHost } from "../lib/desktop-host";

/**
 * Contract tests for the desktop loopback Host guard (spec 041 R18):
 * only in desktop mode (MASARX_DESKTOP_LOOPBACK=1) must non-loopback
 * Host headers be forbidden, and a missing Host must fail closed.
 * isLocalHost keeps its original semantics (moved verbatim from proxy.ts).
 */

afterEach(() => {
  delete process.env.MASARX_DESKTOP_LOOPBACK;
});

describe("isDesktopHostForbidden (R18, spec 041)", () => {
  it("forbids nothing when not in desktop mode", () => {
    expect(isDesktopHostForbidden("attacker.example")).toBe(false);
  });

  it("accepts loopback hosts in desktop mode", () => {
    process.env.MASARX_DESKTOP_LOOPBACK = "1";
    expect(isDesktopHostForbidden("127.0.0.1:43110")).toBe(false);
    expect(isDesktopHostForbidden("localhost:43110")).toBe(false);
    expect(isDesktopHostForbidden("[::1]:43110")).toBe(false);
    expect(isDesktopHostForbidden("127.0.0.2:9917")).toBe(false);
  });

  it("forbids non-loopback hosts in desktop mode", () => {
    process.env.MASARX_DESKTOP_LOOPBACK = "1";
    expect(isDesktopHostForbidden("attacker.example")).toBe(true);
    expect(isDesktopHostForbidden("192.168.1.10:43110")).toBe(true);
  });

  it("fails closed when the Host header is missing in desktop mode", () => {
    process.env.MASARX_DESKTOP_LOOPBACK = "1";
    expect(isDesktopHostForbidden(null)).toBe(true);
    expect(isDesktopHostForbidden("")).toBe(true);
  });
});

describe("isLocalHost (moved from proxy.ts)", () => {
  it("classifies loopback hosts", () => {
    expect(isLocalHost("localhost:3000")).toBe(true);
    expect(isLocalHost("127.0.0.1:43110")).toBe(true);
    expect(isLocalHost("127.9.9.9")).toBe(true);
    expect(isLocalHost("[::1]:3000")).toBe(true);
    expect(isLocalHost("::1")).toBe(true);
  });

  it("rejects non-loopback and malformed hosts", () => {
    expect(isLocalHost("masarx.vercel.app")).toBe(false);
    expect(isLocalHost("192.168.0.1:3000")).toBe(false);
    expect(isLocalHost("127.example.com")).toBe(false);
    expect(isLocalHost(null)).toBe(false);
  });
});
