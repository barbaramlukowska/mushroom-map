import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { speciesRefSchema } from "@runo-map/shared";

// Guards the committed artifact, not the script: species-ref.json is what the seed
// writes to production, so a bad diff fails here rather than at seed time.
// Deliberately does not import fetch-gbif-species.ts — that module runs on import.
const raw: unknown = JSON.parse(
  readFileSync(new URL("../prisma/species-ref.json", import.meta.url), "utf8"),
);

const protectedNames: string[] = (
  JSON.parse(readFileSync(new URL("../prisma/protected-species.json", import.meta.url), "utf8")) as {
    species: string[];
  }
).species;

// The eight species the app shipped with; every existing report points at one of
// them, so dropping any would leave a sighting without a catalogue row.
const LEGACY_KEYS = [5954958, 7832732, 5249504, 7777157, 9141390, 5248629, 2536891, 8914748];

describe("species-ref.json", () => {
  it("parses as a SpeciesRef array", () => {
    expect(() => speciesRefSchema.array().parse(raw)).not.toThrow();
  });

  it("has a unique taxonKey per row (it is the primary key)", () => {
    const species = speciesRefSchema.array().parse(raw);
    expect(new Set(species.map((s) => s.taxonKey)).size).toBe(species.length);
  });

  it("keeps every legacy species the migration backfilled", () => {
    const keys = new Set(speciesRefSchema.array().parse(raw).map((s) => s.taxonKey));
    for (const key of LEGACY_KEYS) expect(keys.has(key)).toBe(true);
  });

  // Nearly one row per regulation name. Not exactly one: a few names are synonyms
  // of each other and collapse onto a single accepted key. A big shortfall means
  // the accepted-key resolution broke and species silently lost their badge.
  it("marks a row for almost every name in protected-species.json", () => {
    const flagged = speciesRefSchema.array().parse(raw).filter((s) => s.isProtected).length;
    expect(flagged).toBeGreaterThanOrEqual(protectedNames.length - 5);
    expect(flagged).toBeLessThanOrEqual(protectedNames.length);
  });

  it("never stores the scientific name as the Polish one", () => {
    const echoes = speciesRefSchema
      .array()
      .parse(raw)
      .filter((s) => s.namePl?.toLowerCase() === s.scientificName.toLowerCase());
    expect(echoes).toEqual([]);
  });

  it("is ordered most-recorded first, with unknown counts last", () => {
    const counts = speciesRefSchema
      .array()
      .parse(raw)
      .map((s) => s.occurrenceCount ?? -1);
    expect([...counts].sort((a, b) => b - a)).toEqual(counts);
  });
});
