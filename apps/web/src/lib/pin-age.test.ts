import { describe, expect, it } from "vitest";
import { pinAgeCategory } from "./pin-age";

const now = new Date("2026-07-13T12:00:00Z");

describe("pinAgeCategory", () => {
  it("returns fresh for a sighting found today", () => {
    expect(pinAgeCategory("2026-07-13T08:00:00Z", now)).toBe("fresh");
  });

  it("returns fresh just under 3 days", () => {
    expect(pinAgeCategory("2026-07-10T13:00:00Z", now)).toBe("fresh");
  });

  it("returns recent at exactly 3 days", () => {
    expect(pinAgeCategory("2026-07-10T12:00:00Z", now)).toBe("recent");
  });

  it("returns recent just under 7 days", () => {
    expect(pinAgeCategory("2026-07-06T13:00:00Z", now)).toBe("recent");
  });

  it("returns older at exactly 7 days", () => {
    expect(pinAgeCategory("2026-07-06T12:00:00Z", now)).toBe("older");
  });

  it("returns older for a month-old sighting", () => {
    expect(pinAgeCategory("2026-06-13T12:00:00Z", now)).toBe("older");
  });
});
