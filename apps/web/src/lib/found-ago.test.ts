import { describe, expect, it } from "vitest";
import { formatFoundAgo } from "./found-ago";

const NOW = new Date("2026-07-28T12:00:00.000Z");
const hoursAgo = (hours: number) =>
  new Date(NOW.getTime() - hours * 60 * 60 * 1000).toISOString();

describe("formatFoundAgo", () => {
  it("says dzisiaj for a report from the last 24 hours", () => {
    expect(formatFoundAgo(hoursAgo(3), NOW)).toBe("dzisiaj");
  });

  it("says wczoraj for a report a day old", () => {
    expect(formatFoundAgo(hoursAgo(30), NOW)).toBe("wczoraj");
  });

  it("counts whole days beyond that", () => {
    expect(formatFoundAgo(hoursAgo(24 * 5), NOW)).toBe("5 dni temu");
  });

  // A foundAt in the future (clock skew) must not print a negative day count.
  it("says dzisiaj for a foundAt in the future", () => {
    expect(formatFoundAgo(hoursAgo(-5), NOW)).toBe("dzisiaj");
  });
});
