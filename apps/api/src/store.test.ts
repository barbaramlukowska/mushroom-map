import { describe, expect, it } from "vitest";
import { type Sighting } from "@runo-map/shared";
import { createStore } from "./store.js";

function sighting(overrides: Partial<Sighting> & Pick<Sighting, "id" | "species">): Sighting {
  return {
    lat: 52.1,
    lng: 21.0,
    foundAt: "2026-07-01T00:00:00.000Z",
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("listSpeciesStats", () => {
  it("returns an empty list for an empty store", async () => {
    expect(await createStore([]).listSpeciesStats()).toEqual([]);
  });

  it("counts every sighting per species and orders most-reported first", async () => {
    const store = createStore([
      sighting({ id: "1", species: "KURKA" }),
      sighting({ id: "2", species: "BOROWIK" }),
      sighting({ id: "3", species: "BOROWIK" }),
      sighting({ id: "4", species: "BOROWIK" }),
    ]);

    const result = await store.listSpeciesStats();

    expect(result.map((s) => [s.species, s.count])).toEqual([
      ["BOROWIK", 3],
      ["KURKA", 1],
    ]);
  });

  it("ignores when a species was first reported", async () => {
    const store = createStore([
      sighting({ id: "1", species: "BOROWIK", createdAt: "2026-06-01T00:00:00.000Z" }),
      sighting({ id: "2", species: "KURKA", createdAt: "2026-07-20T00:00:00.000Z" }),
      sighting({ id: "3", species: "KURKA", createdAt: "2026-07-21T00:00:00.000Z" }),
    ]);

    const result = await store.listSpeciesStats();

    expect(result[0].species).toBe("KURKA");
  });

});

describe("listOccurrenceCells", () => {
  const base = {
    species: "BOROWIK" as const,
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
      { ...base, id: "a", lat: 52.0, lng: 21.0, species: "BOROWIK" },
      { ...base, id: "b", lat: 52.03, lng: 21.03, species: "KURKA" },
    ]);

    const cells = await store.listOccurrenceCells({ species: ["BOROWIK"] }, 0.08);

    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(1);
  });

  it("drops a cell entirely when the filter removes all its sightings", async () => {
    const store = createStore([{ ...base, id: "a", lat: 52.0, lng: 21.0, species: "KURKA" }]);

    expect(await store.listOccurrenceCells({ species: ["BOROWIK"] }, 0.08)).toEqual([]);
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
