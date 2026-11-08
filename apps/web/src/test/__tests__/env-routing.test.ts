// Spec 039 T2 canary: `.test.ts` files must stay on the node project.
// If the projects routing in vitest.config.ts ever regresses (e.g. someone
// reintroduces an ignored legacy key), this fails with "document is defined".
import { describe, expect, it } from "vitest";

describe("vitest 5 environment routing — node project", () => {
  it("runs without a DOM", () => {
    expect(typeof document).toBe("undefined");
  });
});
