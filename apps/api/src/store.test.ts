import { describe, expect, it } from "vitest";
import { SPECIES_COLOR_BUDGET, SPECIES_COLOR_PALETTE, type Sighting } from "@runo-map/shared";
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

  it("gives the palette to the most reported species", async () => {
    const store = createStore([
      sighting({ id: "1", species: "KURKA" }),
      sighting({ id: "2", species: "KURKA" }),
      sighting({ id: "3", species: "BOROWIK" }),
    ]);

    const result = await store.listSpeciesStats();

    expect(result.find((s) => s.species === "KURKA")?.color).toBe(SPECIES_COLOR_PALETTE[0]);
    expect(result.find((s) => s.species === "BOROWIK")?.color).toBe(SPECIES_COLOR_PALETTE[1]);
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

  it("caps colors at the palette size, leaving the rest colorless", async () => {
    const species = ["BOROWIK", "PODGRZYBEK", "KURKA", "MASLAK", "KOZLARZ", "RYDZ"] as const;
    const store = createStore(
      // Descending counts: BOROWIK 6 sightings, PODGRZYBEK 5, ... RYDZ 1.
      species.flatMap((s, i) =>
        Array.from({ length: species.length - i }, (_, n) =>
          sighting({ id: `${s}-${n}`, species: s }),
        ),
      ),
    );

    const result = await store.listSpeciesStats();

    expect(result).toHaveLength(species.length);
    expect(result.filter((s) => s.color)).toHaveLength(SPECIES_COLOR_BUDGET);
    expect(result.find((s) => s.species === "RYDZ")?.color).toBeUndefined();
  });
});
