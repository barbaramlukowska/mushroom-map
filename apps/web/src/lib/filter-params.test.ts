import { describe, expect, it } from "vitest";
import {
  buildCellsQuery,
  buildPageQuery,
  parseDaysParam,
  parseSpeciesParam,
  presetToFromParam,
} from "./filter-params";

const now = new Date("2026-07-14T15:00:00Z");

describe("parseSpeciesParam", () => {
  const reported = new Set([10, 20]);

  it("returns [] when the param is absent", () => {
    expect(parseSpeciesParam(undefined, reported)).toEqual([]);
  });

  it("keeps reported keys and drops the rest", () => {
    expect(parseSpeciesParam(["10", "999", "abc"], reported)).toEqual([10]);
  });

  it("accepts a single value", () => {
    expect(parseSpeciesParam("20", reported)).toEqual([20]);
  });

  it("keeps multiple values", () => {
    expect(parseSpeciesParam(["10", "20"], reported)).toEqual([10, 20]);
  });

  // Also the state before the stats request lands: no filter beats no map.
  it("treats an empty key set as no filter at all", () => {
    expect(parseSpeciesParam(["10"], new Set())).toEqual([]);
  });
});

describe("parseDaysParam", () => {
  it('returns "all" when the param is absent', () => {
    expect(parseDaysParam(undefined)).toBe("all");
  });

  it.each([
    ["3", 3],
    ["7", 7],
    ["14", 14],
  ])("parses %s as a numeric preset", (raw, preset) => {
    expect(parseDaysParam(raw)).toBe(preset);
  });

  it.each([["999"], ["abc"], [""]])('falls back to "all" for %j', (raw) => {
    expect(parseDaysParam(raw)).toBe("all");
  });

  it("takes the first value when the key is repeated", () => {
    expect(parseDaysParam(["7", "14"])).toBe(7);
  });
});

describe("presetToFromParam", () => {
  it('returns undefined for "all"', () => {
    expect(presetToFromParam("all", now)).toBeUndefined();
  });

  it("preset 3 covers 3 calendar days including today", () => {
    expect(presetToFromParam(3, now)).toBe("2026-07-12T00:00:00.000Z");
  });

  it("crosses a month boundary", () => {
    expect(presetToFromParam(7, new Date("2026-07-03T08:00:00Z"))).toBe("2026-06-27T00:00:00.000Z");
  });

  it("preset 14 from mid-July lands on July 1", () => {
    expect(presetToFromParam(14, now)).toBe("2026-07-01T00:00:00.000Z");
  });
});


describe("buildPageQuery", () => {
  it("is empty for the default state", () => {
    expect(buildPageQuery([], "all")).toBe("");
  });

  it("keeps days as a preset and repeats the species key", () => {
    const query = new URLSearchParams(buildPageQuery([10], 3));

    expect(query.getAll("speciesKey")).toEqual(["10"]);
    expect(query.get("days")).toBe("3");
    expect(query.has("from")).toBe(false);
  });
});

describe("buildCellsQuery", () => {
  const NOW = new Date("2026-07-28T12:00:00.000Z");

  it("always sends the zoom — the server needs it to pick a grid step", () => {
    const query = buildCellsQuery([], "all", NOW, "14,49,24,55", 9);

    expect(new URLSearchParams(query).get("zoom")).toBe("9");
  });

  it("sends zoom 0 as a value, not as an omitted param", () => {
    expect(new URLSearchParams(buildCellsQuery([], "all", NOW, null, 0)).get("zoom")).toBe("0");
  });

  it("repeats the speciesKey param once per selected species", () => {
    const params = new URLSearchParams(buildCellsQuery([10, 20], "all", NOW, null, 9));

    expect(params.getAll("speciesKey")).toEqual(["10", "20"]);
  });

  it("turns a day preset into a from date", () => {
    const params = new URLSearchParams(buildCellsQuery([], 3, NOW, null, 9));

    expect(params.get("from")).toBe("2026-07-26T00:00:00.000Z");
  });

  it("omits from for the all preset", () => {
    expect(new URLSearchParams(buildCellsQuery([], "all", NOW, null, 9)).has("from")).toBe(false);
  });

  it("omits bbox before the map reports its first bounds", () => {
    expect(new URLSearchParams(buildCellsQuery([], "all", NOW, null, 9)).has("bbox")).toBe(false);
  });
});
