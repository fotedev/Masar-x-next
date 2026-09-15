import { describe, it, expect } from "vitest";
import { getPostgrestMessage, getPostgrestText, isUniqueViolation } from "../postgrestError";

describe("postgrestError", () => {
  it("reads the message from a PostgrestError plain object", () => {
    expect(getPostgrestMessage({ code: "23505", message: "duplicate key value" })).toBe("duplicate key value");
  });
  it("reads the message from an Error instance", () => {
    expect(getPostgrestMessage(new Error("boom"))).toBe("boom");
  });
  it("returns empty string for unknown shapes", () => {
    expect(getPostgrestMessage({})).toBe("");
    expect(getPostgrestMessage(null)).toBe("");
    expect(getPostgrestText(null)).toBe("");
  });
  it("joins message and details", () => {
    expect(getPostgrestText({ message: "a", details: "b" })).toBe("a b");
  });
  it("detects unique violations by code, by text, and by constraint", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ message: "duplicate key value violates unique constraint" })).toBe(true);
    expect(isUniqueViolation({ message: 'duplicate key value violates unique constraint "subject_lectures_subject_lecture_key_key"' }, "subject_lectures")).toBe(true);
    expect(isUniqueViolation({ message: 'duplicate key value violates unique constraint "other_key"' }, "subject_lectures")).toBe(false);
    expect(isUniqueViolation({ code: "23503", message: "foreign key" })).toBe(false);
  });
});
