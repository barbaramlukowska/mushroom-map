import { describe, expect, it } from "vitest";
import { type Sighting, type SpeciesRef } from "@runo-map/shared";
import { createStore } from "./store.js";

function sighting(overrides: Partial<Sighting> & Pick<Sighting, "id" | "speciesKey">): Sighting {
  return {
    lat: 52.1,
    lng: 21.0,
    foundAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const speciesFixture: SpeciesRef[] = [
  { taxonKey: 1, scientificName: "B sp", namePl: "B", occurrenceCount: 10, isProtected: false },
  { taxonKey: 2, scientificName: "A sp", namePl: "A", occurrenceCount: 99, isProtected: true },
  { taxonKey: 3, scientificName: "C sp", namePl: null, occurrenceCount: null, isProtected: false },
];

describe("createStore species methods", () => {
  it("lists species by occurrenceCount desc, nulls last", async () => {
    const store = createStore([], speciesFixture);
    const keys = (await store.listSpecies()).map((s) => s.taxonKey);
    expect(keys).toEqual([2, 1, 3]);
  });

  it("reports existence by key", async () => {
    const store = createStore([], speciesFixture);
    expect(await store.speciesExists(2)).toBe(true);
    expect(await store.speciesExists(999)).toBe(false);
  });

  it("serves an empty catalogue when no species were seeded", async () => {
    expect(await createStore([]).listSpecies()).toEqual([]);
  });
});

describe("listSpeciesStats", () => {
  it("returns an empty list for an empty store", async () => {
    expect(await createStore([]).listSpeciesStats()).toEqual([]);
  });

  it("counts every sighting per species and orders most-reported first", async () => {
    const store = createStore([
      sighting({ id: "1", speciesKey: 20 }),
      sighting({ id: "2", speciesKey: 10 }),
      sighting({ id: "3", speciesKey: 10 }),
      sighting({ id: "4", speciesKey: 10 }),
    ]);

    const result = await store.listSpeciesStats();

    expect(result.map((s) => [s.speciesKey, s.count])).toEqual([
      [10, 3],
      [20, 1],
    ]);
  });

  it("ignores when a species was first reported", async () => {
    const store = createStore([
      sighting({ id: "1", speciesKey: 10, createdAt: "2026-06-01T00:00:00.000Z" }),
      sighting({ id: "2", speciesKey: 20, createdAt: "2026-07-20T00:00:00.000Z" }),
      sighting({ id: "3", speciesKey: 20, createdAt: "2026-07-21T00:00:00.000Z" }),
    ]);

    const result = await store.listSpeciesStats();

    expect(result[0].speciesKey).toBe(20);
  });
});

describe("listOccurrenceCells", () => {
  const base = {
    speciesKey: 10,
    foundAt: "2026-07-20T00:00:00.000Z",
    createdAt: "2026-07-20T10:00:00.000Z",
  };

  it("returns an empty list when there are no sightings", async () => {
    const store = createStore([]);

    expect(await store.listOccurrenceCells({}, 0.08)).toEqual([]);
  });

  it("groups sightings inside one step into a single cell", async () => {
    const store = createStore([
      { ...base, id: "a", lat: 52.0, lng: 21.0 },
      { ...base, id: "b", lat: 52.03, lng: 21.03 },
    ]);

    const cells = await store.listOccurrenceCells({}, 0.08);

    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(2);
  });

  it("applies the species filter before aggregating", async () => {
    const store = createStore([
      { ...base, id: "a", lat: 52.0, lng: 21.0, speciesKey: 10 },
      { ...base, id: "b", lat: 52.03, lng: 21.03, speciesKey: 20 },
    ]);

    const cells = await store.listOccurrenceCells({ speciesKey: [10] }, 0.08);

    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(1);
  });

  it("drops a cell entirely when the filter removes all its sightings", async () => {
    const store = createStore([{ ...base, id: "a", lat: 52.0, lng: 21.0, speciesKey: 20 }]);

    expect(await store.listOccurrenceCells({ speciesKey: [10] }, 0.08)).toEqual([]);
  });

  it("applies the date filter before aggregating", async () => {
    const store = createStore([
      { ...base, id: "old", lat: 52.0, lng: 21.0, foundAt: "2026-07-01T00:00:00.000Z" },
      { ...base, id: "new", lat: 52.0, lng: 21.0, foundAt: "2026-07-25T00:00:00.000Z" },
    ]);

    const cells = await store.listOccurrenceCells({ from: "2026-07-20T00:00:00.000Z" }, 0.08);

    expect(cells[0].count).toBe(1);
    expect(cells[0].newestFoundAt).toBe("2026-07-25T00:00:00.000Z");
  });

  it("applies the bbox filter before aggregating", async () => {
    const store = createStore([
      { ...base, id: "inside", lat: 52.0, lng: 21.0 },
      { ...base, id: "outside", lat: 49.5, lng: 15.0 },
    ]);

    const cells = await store.listOccurrenceCells(
      { bbox: [20.5, 51.5, 21.5, 52.5] },
      0.08,
    );

    expect(cells).toHaveLength(1);
  });

  it("returns fewer cells at a coarser step", async () => {
    const store = createStore([
      { ...base, id: "a", lat: 52.0, lng: 21.0 },
      { ...base, id: "b", lat: 52.09, lng: 21.0 },
    ]);

    expect(await store.listOccurrenceCells({}, 0.08)).toHaveLength(2);
    expect(await store.listOccurrenceCells({}, 0.32)).toHaveLength(1);
  });
});
