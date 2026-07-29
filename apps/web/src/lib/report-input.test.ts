import { describe, expect, it } from "vitest";
import { sightingInputSchema } from "@runo-map/shared";
import { toSightingInput } from "./report-input";

const location = { lat: 52.23, lng: 21.01 };

describe("toSightingInput", () => {
  it("converts the date to UTC-midnight ISO", () => {
    const result = toSightingInput({ speciesKey: 10, foundAt: "2026-07-13", comment: "" }, location);
    expect(result.foundAt).toBe("2026-07-13T00:00:00.000Z");
  });

  it("carries the clicked coordinates and the species key", () => {
    const result = toSightingInput({ speciesKey: 20, foundAt: "2026-07-13", comment: "" }, location);
    expect(result).toMatchObject({ speciesKey: 20, lat: 52.23, lng: 21.01 });
  });

  it("maps an empty comment to undefined", () => {
    const result = toSightingInput({ speciesKey: 30, foundAt: "2026-07-13", comment: "" }, location);
    expect(result.comment).toBeUndefined();
  });

  it("maps a whitespace-only comment to undefined", () => {
    const result = toSightingInput(
      { speciesKey: 30, foundAt: "2026-07-13", comment: "   " },
      location,
    );
    expect(result.comment).toBeUndefined();
  });

  it("keeps a real comment", () => {
    const result = toSightingInput(
      { speciesKey: 30, foundAt: "2026-07-13", comment: "skraj lasu" },
      location,
    );
    expect(result.comment).toBe("skraj lasu");
  });

  it("produces a body that passes the shared schema", () => {
    const result = toSightingInput({ speciesKey: 40, foundAt: "2026-07-13", comment: "" }, location);
    expect(sightingInputSchema.safeParse(result).success).toBe(true);
  });

  // The form's default when the catalogue failed to load. It must not pass:
  // a silent bad POST is worse than the "Wybierz gatunek grzyba." field error.
  it("produces a body the shared schema rejects when no species was picked", () => {
    const result = toSightingInput({ speciesKey: 0, foundAt: "2026-07-13", comment: "" }, location);
    expect(sightingInputSchema.safeParse(result).success).toBe(false);
  });
});
