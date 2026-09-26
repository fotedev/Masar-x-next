import { describe, expect, it } from "vitest";
import {
  CourseSchema,
  CourseWithInstructorSchema,
  NewsSchema,
  ProfileSchema,
  QuizSchema,
  WaitlistSignupSchema,
  WaitlistSourceSchema,
} from "../index";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("ProfileSchema", () => {
  it("accepts a minimal valid profile", () => {
    const parsed = ProfileSchema.safeParse({
      id: UUID,
      username: "ahmed",
      full_name: "Ahmed Hassan",
      display_name: "Ahmed",
      avatar_url: null,
      level: 2,
      semester: 4,
      department_id: null,
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a non-uuid id", () => {
    const parsed = ProfileSchema.safeParse({
      id: "not-a-uuid",
      username: null,
      full_name: null,
      display_name: null,
      avatar_url: null,
      level: null,
      semester: null,
      department_id: null,
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-integer level", () => {
    const parsed = ProfileSchema.safeParse({
      id: UUID,
      username: null,
      full_name: null,
      display_name: null,
      avatar_url: null,
      level: 2.5,
      semester: null,
      department_id: null,
    });
    expect(parsed.success).toBe(false);
  });
});

describe("CourseSchema", () => {
  const base = {
    id: UUID,
    title: "Anatomy Basics",
    description: "Intro course",
    instructor_id: UUID,
    created_at: "2025-01-05T00:00:00Z",
  };

  it("applies defaults for price/is_published/is_academic", () => {
    const parsed = CourseSchema.parse(base);
    expect(parsed.price).toBe(0);
    expect(parsed.is_published).toBe(false);
    expect(parsed.is_academic).toBe(true);
  });

  it("rejects an invalid created_at date string", () => {
    const parsed = CourseSchema.safeParse({ ...base, created_at: "not-a-date" });
    expect(parsed.success).toBe(false);
  });

  it("CourseWithInstructorSchema tolerates nullable aggregates", () => {
    const parsed = CourseWithInstructorSchema.parse({
      ...base,
      instructor_name: "Dr. Salma",
      enrollments_count: null,
      average_rating: null,
      total_students: 0,
    });
    expect(parsed.instructor_name).toBe("Dr. Salma");
    expect(parsed.total_students).toBe(0);
  });
});

describe("NewsSchema", () => {
  const base = {
    id: UUID,
    title: "Midterm schedule",
    content: "Rooms announced",
    type: "announcement",
    created_at: "2025-03-01",
  };

  it("defaults priority/image_urls/is_active", () => {
    const parsed = NewsSchema.parse(base);
    expect(parsed.priority).toBe(0);
    expect(parsed.image_urls).toEqual([]);
    expect(parsed.is_active).toBe(true);
  });

  it("enforces the 4-digit year regex when year is provided", () => {
    expect(NewsSchema.safeParse({ ...base, year: "25" }).success).toBe(false);
    expect(NewsSchema.safeParse({ ...base, year: "2025" }).success).toBe(true);
    expect(NewsSchema.safeParse({ ...base, year: null }).success).toBe(true);
  });
});

describe("QuizSchema", () => {
  it("defaults status to draft", () => {
    const parsed = QuizSchema.parse({
      id: UUID,
      title: "Cardio quiz",
    });
    expect(parsed.status).toBe("draft");
  });

  it("rejects a malformed year", () => {
    expect(
      QuizSchema.safeParse({ id: UUID, title: "Q", year: "abcd" }).success,
    ).toBe(false);
  });
});

describe("Waitlist schemas (spec 021)", () => {
  it("accepts the three allowed sources", () => {
    for (const source of ["trw", "macos", "android"] as const) {
      expect(
        WaitlistSignupSchema.safeParse({ email: "a@b.co", source }).success,
      ).toBe(true);
    }
    expect(WaitlistSourceSchema.safeParse("web").success).toBe(false);
  });

  it("normalizes email: trims and lowercases", () => {
    const parsed = WaitlistSignupSchema.parse({
      email: "  Student@Example.COM ",
      source: "macos",
    });
    expect(parsed.email).toBe("student@example.com");
  });

  it("rejects an oversized or malformed email", () => {
    expect(
      WaitlistSignupSchema.safeParse({ email: "not-an-email", source: "trw" })
        .success,
    ).toBe(false);
    expect(
      WaitlistSignupSchema.safeParse({
        email: `${"a".repeat(250)}@b.co`,
        source: "trw",
      }).success,
    ).toBe(false);
  });
});
