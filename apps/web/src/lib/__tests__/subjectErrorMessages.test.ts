import { describe, it, expect } from "vitest";
import { resolveSubjectSaveError } from "../subjectErrorMessages";

const messages: Record<string, string> = {
  duplicateName: "DUPLICATE_NAME",
  saveErrorFallback: "GENERIC_FALLBACK",
};
const t = (key: string) => messages[key] ?? key;

describe("resolveSubjectSaveError", () => {
  it("maps a 23505 duplicate-key code to the localized duplicate-name message", () => {
    expect(
      resolveSubjectSaveError(
        { code: "23505", message: 'duplicate key value violates unique constraint "subjects_name_key"' },
        t,
      ),
    ).toBe("DUPLICATE_NAME");
  });

  it("detects a duplicate when only the constraint name is present", () => {
    expect(
      resolveSubjectSaveError(
        { message: 'duplicate key value violates unique constraint "subjects_name_key"' },
        t,
      ),
    ).toBe("DUPLICATE_NAME");
  });

  it("surfaces the raw PostgrestError message for non-duplicate backend errors", () => {
    const raw = "insert or update on table violates foreign key constraint";
    expect(resolveSubjectSaveError({ code: "23503", message: raw, details: "FKey detail" }, t)).toBe(raw);
  });

  it("surfaces the message of a thrown Error instance", () => {
    expect(resolveSubjectSaveError(new Error("network unreachable"), t)).toBe("network unreachable");
  });

  it("falls back to the generic message when no usable text exists", () => {
    expect(resolveSubjectSaveError({}, t)).toBe("GENERIC_FALLBACK");
    expect(resolveSubjectSaveError(null, t)).toBe("GENERIC_FALLBACK");
  });
});
