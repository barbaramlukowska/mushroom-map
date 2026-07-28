import { describe, expect, it } from "vitest";
import { buildSpeciesStats } from "./species-stats.js";

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

  it("does not mutate the caller's array", () => {
    const tallies = [
      { species: "KURKA", count: 2 },
      { species: "BOROWIK", count: 7 },
    ];

    buildSpeciesStats(tallies);

    expect(tallies[0].species).toBe("KURKA");
  });

  it("never returns a color field — colour no longer carries species identity", () => {
    const stats = buildSpeciesStats([
      { species: "BOROWIK", count: 7 },
      { species: "KURKA", count: 2 },
    ]);

    for (const stat of stats) {
      expect(Object.keys(stat).sort()).toEqual(["count", "species"]);
    }
  });

  it("breaks ties alphabetically so the order never wobbles between requests", () => {
    const stats = buildSpeciesStats([
      { species: "KURKA", count: 3 },
      { species: "BOROWIK", count: 3 },
    ]);

    expect(stats.map((s) => s.species)).toEqual(["BOROWIK", "KURKA"]);
  });
});
