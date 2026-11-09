// Spec 039 T2 canary: `.test.tsx` files must land in the jsdom project.
// If the projects routing in vitest.config.ts ever regresses, this fails
// with "document is undefined" (the vitest-5 silent-ignore failure mode).
import { describe, expect, it } from "vitest";

describe("vitest 5 environment routing — jsdom project", () => {
  it("has a live DOM", () => {
    expect(typeof document).toBe("object");
    const el = document.createElement("div");
    expect(el.tagName).toBe("DIV");
  });
});
