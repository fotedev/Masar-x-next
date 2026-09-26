import { describe, expect, it } from "vitest";
import { getTextDirection } from "../textDirection";

describe("getTextDirection", () => {
  it("returns rtl for pure Arabic text", () => {
    expect(getTextDirection("مرحبا بالعالم")).toBe("rtl");
  });

  it("returns ltr for pure English text", () => {
    expect(getTextDirection("Hello world")).toBe("ltr");
  });

  it("returns ltr for empty and whitespace-only strings", () => {
    expect(getTextDirection("")).toBe("ltr");
    expect(getTextDirection("   ")).toBe("ltr");
    expect(getTextDirection("123 !@#")).toBe("ltr");
  });

  it("ties (equal counts) resolve to rtl", () => {
    // 1 Arabic letter vs 1 English letter — >= means rtl.
    expect(getTextDirection("a ا")).toBe("rtl");
    expect(getTextDirection("x ب")).toBe("rtl");
    expect(getTextDirection("abc")).toBe("ltr");
  });

  it("majority Arabic with English mixed → rtl; majority English with Arabic → ltr", () => {
    expect(getTextDirection("الكلمة quiz في الجملة")).toBe("rtl");
    expect(getTextDirection("The word كلمة inside the sentence")).toBe("ltr");
  });
});
