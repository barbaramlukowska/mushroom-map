import { describe, expect, it } from "vitest";
import { SPECIES } from "@runo-map/shared";
import { sortSpeciesByReports } from "./species-order";

describe("sortSpeciesByReports", () => {
  it("keeps the original order when nothing has been reported", () => {
    expect(sortSpeciesByReports(SPECIES, [])).toEqual([...SPECIES]);
  });

  it("follows the order the API sent, most reported first", () => {
    const sorted = sortSpeciesByReports(SPECIES, [
      { species: "KURKA", count: 9 },
      { species: "BOROWIK", count: 4 },
    ]);

    expect(sorted.slice(0, 2)).toEqual(["KURKA", "BOROWIK"]);
  });

  it("parks never-reported species after the reported ones, in their original order", () => {
    const sorted = sortSpeciesByReports(SPECIES, [{ species: "KANIA", count: 1 }]);

    expect(sorted[0]).toBe("KANIA");
    expect(sorted.slice(1)).toEqual(SPECIES.filter((s) => s !== "KANIA"));
  });

  it("returns every species exactly once", () => {
    const sorted = sortSpeciesByReports(SPECIES, [
      { species: "RYDZ", count: 3 },
      { species: "MASLAK", count: 2 },
    ]);

    expect(new Set(sorted).size).toBe(SPECIES.length);
  });

  it("ignores stats for species the app does not list", () => {
    const sorted = sortSpeciesByReports(SPECIES, [
      { species: "MUCHOMOR", count: 99 },
      { species: "RYDZ", count: 1 },
    ]);

    expect(sorted[0]).toBe("RYDZ");
    expect(sorted).toHaveLength(SPECIES.length);
  });

  it("does not mutate the caller's list", () => {
    const input = [...SPECIES];

    sortSpeciesByReports(input, [{ species: "KANIA", count: 1 }]);

    expect(input).toEqual([...SPECIES]);
  });
});
