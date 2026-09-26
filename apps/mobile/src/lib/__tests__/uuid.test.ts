import { describe, expect, it } from "vitest";
import { uuid4 } from "../uuid";

describe("uuid4", () => {
  it("emits RFC-4122 v4 shape", () => {
    const id = uuid4();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("sets the version nibble to 4 and the variant nibble to 8/9/a/b", () => {
    for (let i = 0; i < 50; i++) {
      const id = uuid4();
      expect(id[14]).toBe("4");
      expect(["8", "9", "a", "b"]).toContain(id[19]);
    }
  });

  it("generates distinct ids", () => {
    const seen = new Set(Array.from({ length: 200 }, () => uuid4()));
    expect(seen.size).toBe(200);
  });
});
