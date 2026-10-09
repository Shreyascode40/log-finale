import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime, signedBy } from "@/lib/format";
import { fromJson, toJson } from "@/lib/json";

describe("format helpers", () => {
  it("renders a signature as 'Signed by <name> on <date time>'", () => {
    const out = signedBy("Rahul Patil", new Date("2025-07-01T10:30:00"));
    expect(out).toMatch(/^Signed by Rahul Patil on /);
    expect(out).toContain("2025");
  });

  it("returns empty strings for missing values", () => {
    expect(formatDateTime(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(signedBy(null, null)).toBe("");
  });
});

describe("json helpers (SQLite String columns)", () => {
  it("round-trips values", () => {
    const value = { p1: "HIGH", list: [1, 2, 3] };
    expect(fromJson(toJson(value), {})).toEqual(value);
  });

  it("falls back on invalid or empty input", () => {
    expect(fromJson("{not json", { safe: true })).toEqual({ safe: true });
    expect(fromJson(null, [])).toEqual([]);
    expect(fromJson("", { a: 1 })).toEqual({ a: 1 });
  });
});
