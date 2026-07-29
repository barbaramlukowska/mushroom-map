import { describe, expect, it } from "vitest";
import { buildSpeciesStats } from "./species-stats.js";

describe("buildSpeciesStats", () => {
  it("returns an empty list for no sightings", () => {
    expect(buildSpeciesStats([])).toEqual([]);
  });

  it("puts the most-reported species first", () => {
    const stats = buildSpeciesStats([
      { speciesKey: 10, count: 2 },
      { speciesKey: 20, count: 9 },
    ]);

    expect(stats.map((s) => s.speciesKey)).toEqual([20, 10]);
    expect(stats.map((s) => s.count)).toEqual([9, 2]);
  });

  it("does not mutate the caller's array", () => {
    const tallies = [
      { speciesKey: 10, count: 2 },
      { speciesKey: 20, count: 9 },
    ];

    buildSpeciesStats(tallies);

    expect(tallies[0].speciesKey).toBe(10);
  });

  it("never returns a color field — colour no longer carries species identity", () => {
    const stats = buildSpeciesStats([
      { speciesKey: 20, count: 9 },
      { speciesKey: 10, count: 2 },
    ]);

    for (const stat of stats) {
      expect(Object.keys(stat).sort()).toEqual(["count", "speciesKey"]);
    }
  });

  it("breaks ties by key so the order never wobbles", () => {
    const stats = buildSpeciesStats([
      { speciesKey: 30, count: 4 },
      { speciesKey: 10, count: 4 },
      { speciesKey: 20, count: 4 },
    ]);

    expect(stats.map((s) => s.speciesKey)).toEqual([10, 20, 30]);
  });
});
