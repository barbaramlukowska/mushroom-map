import { describe, expect, it } from "vitest";
import {
  speciesRefSchema,
  gbifSpeciesSchema,
  gbifMatchSchema,
  gbifFacetSchema,
  wikidataBindingSchema,
  sightingInputSchema,
  sightingFilterSchema,
  occurrenceCellFilterSchema,
} from "./index.js";

describe("speciesRefSchema", () => {
  it("accepts a full record and a name-less one", () => {
    expect(
      speciesRefSchema.parse({
        taxonKey: 2526745,
        scientificName: "Imleria badia",
        namePl: "Podgrzybek brunatny",
        occurrenceCount: 1190,
        isProtected: false,
      }).taxonKey,
    ).toBe(2526745);
    const noName = speciesRefSchema.parse({
      taxonKey: 1,
      scientificName: "Foo bar",
      namePl: null,
      occurrenceCount: null,
      isProtected: true,
    });
    expect(noName.namePl).toBeNull();
  });

  it("rejects a non-positive taxonKey", () => {
    expect(() =>
      speciesRefSchema.parse({
        taxonKey: 0,
        scientificName: "x",
        namePl: null,
        occurrenceCount: null,
        isProtected: false,
      }),
    ).toThrow();
  });
});

describe("gbifSpeciesSchema", () => {
  it("keeps a Fungi record and tolerates extra fields", () => {
    const parsed = gbifSpeciesSchema.parse({
      key: 2526745,
      scientificName: "Imleria badia (Fr.) Vizzini",
      canonicalName: "Imleria badia",
      kingdomKey: 5,
      rank: "SPECIES",
      unexpected: "ignored",
    });
    expect(parsed.kingdomKey).toBe(5);
  });

  it("rejects a non-Fungi kingdomKey", () => {
    expect(() =>
      gbifSpeciesSchema.parse({
        key: 1,
        scientificName: "x",
        canonicalName: "x",
        kingdomKey: 1,
        rank: "SPECIES",
      }),
    ).toThrow();
  });
});

describe("gbifMatchSchema", () => {
  it("takes the resolved key and ignores the rest of the match payload", () => {
    const parsed = gbifMatchSchema.parse({ usageKey: 5954958, matchType: "EXACT", confidence: 99 });
    expect(parsed.usageKey).toBe(5954958);
    // Absent for an accepted name — the caller then uses usageKey as-is.
    expect(parsed.acceptedUsageKey).toBeUndefined();
  });

  // A synonym match carries the accepted taxon's key, and that is the one the
  // pipeline follows: occurrence facets count accepted taxa, so keeping the
  // synonym key would put a second catalogue row on the same fungus.
  it("keeps the accepted key when the matched name is a synonym", () => {
    const parsed = gbifMatchSchema.parse({
      usageKey: 2542344,
      acceptedUsageKey: 8179389,
      canonicalName: "Fomitopsis rosea",
      status: "SYNONYM",
    });
    expect(parsed.acceptedUsageKey).toBe(8179389);
  });

  it("rejects a no-match response, which carries no usageKey", () => {
    expect(() => gbifMatchSchema.parse({ matchType: "NONE", confidence: 0 })).toThrow();
  });
});

describe("gbifFacetSchema", () => {
  it("parses a facet count entry", () => {
    expect(gbifFacetSchema.parse({ name: "2526745", count: 1190 })).toEqual({
      name: "2526745",
      count: 1190,
    });
  });
});

describe("wikidataBindingSchema", () => {
  it("extracts the key and its Polish label", () => {
    const b = wikidataBindingSchema.parse({
      gbif: { value: "8168319" },
      itemLabel: { value: "Muchomor czerwony", "xml:lang": "pl" },
    });
    expect(b.gbif.value).toBe("8168319");
    expect(b.itemLabel.value).toBe("Muchomor czerwony");
  });

  // The batched query pairs each label with its key; a binding without one
  // cannot be assigned to a species.
  it("rejects a binding with no key", () => {
    expect(() =>
      wikidataBindingSchema.parse({ itemLabel: { value: "Muchomor czerwony", "xml:lang": "pl" } }),
    ).toThrow();
  });
});

describe("filter schemas use speciesKey", () => {
  it("validates input with a numeric speciesKey", () => {
    const parsed = sightingInputSchema.parse({
      speciesKey: 2526745,
      lat: 52.1,
      lng: 21.2,
      foundAt: "2026-07-05T00:00:00.000Z",
    });
    expect(parsed.speciesKey).toBe(2526745);
  });

  it("coerces repeatable speciesKey query params to a number array", () => {
    expect(sightingFilterSchema.parse({ speciesKey: ["1", "2"] }).speciesKey).toEqual([1, 2]);
    expect(sightingFilterSchema.parse({ speciesKey: "3" }).speciesKey).toEqual([3]);
  });

  it("applies the same speciesKey rule to the occurrence-cell filter", () => {
    const parsed = occurrenceCellFilterSchema.parse({ zoom: "8", speciesKey: ["1", "2"] });
    expect(parsed.speciesKey).toEqual([1, 2]);
  });

  it("rejects a non-numeric speciesKey filter", () => {
    expect(sightingFilterSchema.safeParse({ speciesKey: "not-a-key" }).success).toBe(false);
  });
});
