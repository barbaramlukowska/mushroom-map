import { describe, expect, it } from "vitest";
import {
  SPECIES_COLOR_BUDGET,
  SPECIES_COLOR_PALETTE,
  buildSpeciesStats,
} from "./species-color.js";

describe("SPECIES_COLOR_PALETTE", () => {
  it("holds four 6-digit hex colors", () => {
    expect(SPECIES_COLOR_PALETTE).toHaveLength(4);
    for (const color of SPECIES_COLOR_PALETTE) {
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(SPECIES_COLOR_PALETTE).size).toBe(SPECIES_COLOR_PALETTE.length);
  });

  it("exposes its length as the budget", () => {
    expect(SPECIES_COLOR_BUDGET).toBe(SPECIES_COLOR_PALETTE.length);
  });
});

describe("buildSpeciesStats", () => {
  it("returns an empty list for no sightings", () => {
    expect(buildSpeciesStats([])).toEqual([]);
  });

  it("orders species by report count, most reported first", () => {
    const stats = buildSpeciesStats([
      { species: "KURKA", count: 2 },
      { species: "BOROWIK", count: 7 },
    ]);

    expect(stats.map((s) => s.species)).toEqual(["BOROWIK", "KURKA"]);
    expect(stats.map((s) => s.count)).toEqual([7, 2]);
  });

  it("hands the palette to the most reported species, in order", () => {
    const stats = buildSpeciesStats([
      { species: "KURKA", count: 2 },
      { species: "BOROWIK", count: 7 },
    ]);

    expect(stats[0].color).toBe(SPECIES_COLOR_PALETTE[0]);
    expect(stats[1].color).toBe(SPECIES_COLOR_PALETTE[1]);
  });

  it("breaks count ties alphabetically so neither order nor color wobbles", () => {
    const stats = buildSpeciesStats([
      { species: "RYDZ", count: 3 },
      { species: "KANIA", count: 3 },
    ]);

    expect(stats.map((s) => s.species)).toEqual(["KANIA", "RYDZ"]);
    expect(stats[0].color).toBe(SPECIES_COLOR_PALETTE[0]);
  });

  it("leaves species beyond the budget without a color", () => {
    const stats = buildSpeciesStats(
      ["A", "B", "C", "D", "E", "F"].map((species, index) => ({
        species,
        count: 10 - index,
      })),
    );

    expect(stats.filter((s) => s.color)).toHaveLength(SPECIES_COLOR_BUDGET);
    expect(stats[SPECIES_COLOR_BUDGET].color).toBeUndefined();
    expect(stats.at(-1)?.color).toBeUndefined();
  });

  it("moves a color to the species that overtakes on count", () => {
    const before = buildSpeciesStats([
      { species: "BOROWIK", count: 5 },
      { species: "KURKA", count: 3 },
    ]);
    const after = buildSpeciesStats([
      { species: "BOROWIK", count: 5 },
      { species: "KURKA", count: 9 },
    ]);

    expect(before[0].species).toBe("BOROWIK");
    expect(after[0].species).toBe("KURKA");
    expect(after[0].color).toBe(SPECIES_COLOR_PALETTE[0]);
  });

  it("does not mutate the caller's array", () => {
    const tallies = [
      { species: "KURKA", count: 2 },
      { species: "BOROWIK", count: 7 },
    ];

    buildSpeciesStats(tallies);

    expect(tallies[0].species).toBe("KURKA");
  });
});
