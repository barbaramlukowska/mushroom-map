import { describe, expect, it } from "vitest";
import { CELL_STEPS, cellStepForZoom } from "./occurrence-cell.js";
import { cellCenter, cellKey } from "./occurrence-cell.js";
import { aggregateCells } from "./occurrence-cell.js";
import type { Sighting } from "./sighting.js";
import { occurrenceCellFilterSchema } from "./occurrence-cell.js";

describe("CELL_STEPS", () => {
  it("goes from coarsest to finest", () => {
    expect(CELL_STEPS).toEqual([0.32, 0.16, 0.08, 0.04, 0.02, 0.01, 0.005]);
  });

  // Every step is a multiple of the 0.005 storage grid from apps/api/src/geo.ts,
  // so a cell boundary never falls between two stored coordinates.
  it("has every step as a whole multiple of the 0.005 storage grid", () => {
    for (const step of CELL_STEPS) {
      expect(Math.round(step / 0.005) * 0.005).toBeCloseTo(step, 10);
    }
  });

  it("halves at every level, so zooming in splits a cell into four", () => {
    for (let i = 1; i < CELL_STEPS.length; i++) {
      expect(CELL_STEPS[i]).toBeCloseTo(CELL_STEPS[i - 1] / 2, 10);
    }
  });
});

describe("cellStepForZoom", () => {
  it.each([
    [4, 0.32],
    [6, 0.32],
    [7, 0.16],
    [8, 0.08],
    [9, 0.08],
    [10, 0.04],
    [11, 0.02],
    [12, 0.01],
    [13, 0.005],
    [18, 0.005],
  ])("maps zoom %i to step %f", (zoom, step) => {
    expect(cellStepForZoom(zoom)).toBe(step);
  });

  it("clamps below the shallowest zoom to the coarsest step", () => {
    expect(cellStepForZoom(0)).toBe(0.32);
  });

  it("never returns a step outside the ladder", () => {
    for (let zoom = 0; zoom <= 20; zoom++) {
      expect(CELL_STEPS).toContain(cellStepForZoom(zoom));
    }
  });

  // Leaflet's zoomSnap can be set below 1, which makes fractional zooms real.
  // A fractional zoom must behave like the integer below it, never fall through
  // to the finest step.
  it("floors a fractional zoom to the step of the integer below it", () => {
    expect(cellStepForZoom(6.5)).toBe(cellStepForZoom(6));
    expect(cellStepForZoom(7.75)).toBe(cellStepForZoom(7));
    expect(cellStepForZoom(12.25)).toBe(cellStepForZoom(12));
    expect(cellStepForZoom(13.5)).toBe(cellStepForZoom(13));
  });

  it("never returns a step outside the ladder for fractional zooms either", () => {
    for (let zoom = 0; zoom <= 20; zoom += 0.25) {
      expect(CELL_STEPS).toContain(cellStepForZoom(zoom));
    }
  });
});

describe("cellKey", () => {
  it("puts two coordinates inside one step into the same cell", () => {
    expect(cellKey(52.001, 21.001, 0.08)).toBe(cellKey(52.07, 21.03, 0.08));
  });

  it("puts coordinates a full step apart into different cells", () => {
    expect(cellKey(52.0, 21.0, 0.08)).not.toBe(cellKey(52.09, 21.0, 0.08));
  });

  it("separates cells that share a latitude but differ in longitude", () => {
    expect(cellKey(52.0, 21.0, 0.08)).not.toBe(cellKey(52.0, 21.09, 0.08));
  });

  it("is stable regardless of floating-point noise in the input", () => {
    expect(cellKey(52.00000000001, 21.0, 0.02)).toBe(cellKey(52.0, 21.0, 0.02));
  });
});

describe("cellCenter", () => {
  it("returns the middle of the cell, not its corner", () => {
    const key = cellKey(52.0, 21.0, 0.08);
    const center = cellCenter(key, 0.08);

    expect(center.lat).toBeCloseTo(52.04, 6);
    expect(center.lng).toBeCloseTo(21, 6);
  });

  it("round-trips every coordinate back into the same cell", () => {
    const key = cellKey(53.417, 14.553, 0.02);
    const center = cellCenter(key, 0.02);

    expect(cellKey(center.lat, center.lng, 0.02)).toBe(key);
  });

  it("works for negative longitudes", () => {
    const key = cellKey(52.0, -1.05, 0.1);
    const center = cellCenter(key, 0.1);

    expect(cellKey(center.lat, center.lng, 0.1)).toBe(key);
  });
});

function sighting(overrides: Partial<Sighting> = {}): Sighting {
  return {
    id: "id-1",
    species: "BOROWIK",
    lat: 52.0,
    lng: 21.0,
    foundAt: "2026-07-20T00:00:00.000Z",
    createdAt: "2026-07-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("aggregateCells", () => {
  it("returns an empty list for no sightings", () => {
    expect(aggregateCells([], 0.08)).toEqual([]);
  });

  it("counts sightings that fall into the same cell", () => {
    const cells = aggregateCells(
      [
        sighting({ id: "a", lat: 52.0, lng: 21.0 }),
        sighting({ id: "b", lat: 52.03, lng: 21.03 }),
      ],
      0.08,
    );

    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(2);
  });

  it("splits sightings a full step apart into separate cells", () => {
    const cells = aggregateCells(
      [
        sighting({ id: "a", lat: 52.0, lng: 21.0 }),
        sighting({ id: "b", lat: 52.5, lng: 21.0 }),
      ],
      0.08,
    );

    expect(cells).toHaveLength(2);
    expect(cells.map((cell) => cell.count)).toEqual([1, 1]);
  });

  // The cell's colour comes from this value, and the question it answers is
  // "is this still worth a trip" — so it must be the newest, not an average.
  it("takes the NEWEST foundAt in the cell, not the oldest", () => {
    const cells = aggregateCells(
      [
        sighting({ id: "old", foundAt: "2026-07-01T00:00:00.000Z" }),
        sighting({ id: "new", foundAt: "2026-07-25T00:00:00.000Z" }),
        sighting({ id: "mid", foundAt: "2026-07-10T00:00:00.000Z" }),
      ],
      0.08,
    );

    expect(cells[0].newestFoundAt).toBe("2026-07-25T00:00:00.000Z");
  });

  it("reports the cell centre, not the position of any single sighting", () => {
    const cells = aggregateCells([sighting({ lat: 52.0, lng: 21.0 })], 0.08);

    expect(cells[0].lat).toBeCloseTo(52.04, 6);
    expect(cells[0].lng).toBeCloseTo(21, 6);
  });

  it("puts the same sightings into fewer cells at a coarser step", () => {
    const input = [
      sighting({ id: "a", lat: 52.0, lng: 21.0 }),
      sighting({ id: "b", lat: 52.09, lng: 21.0 }),
    ];

    expect(aggregateCells(input, 0.08)).toHaveLength(2);
    expect(aggregateCells(input, 0.32)).toHaveLength(1);
  });

  it("counts sightings of different species together — species is not encoded", () => {
    const cells = aggregateCells(
      [
        sighting({ id: "a", species: "BOROWIK" }),
        sighting({ id: "b", species: "KURKA" }),
      ],
      0.08,
    );

    expect(cells).toHaveLength(1);
    expect(cells[0].count).toBe(2);
  });
});

describe("occurrenceCellFilterSchema", () => {
  it("accepts a full query", () => {
    const parsed = occurrenceCellFilterSchema.safeParse({
      zoom: "9",
      bbox: "14.1,49.1,24.1,54.9",
      species: ["BOROWIK", "KURKA"],
      from: "2026-07-01T00:00:00.000Z",
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.zoom).toBe(9);
    expect(parsed.data.species).toEqual(["BOROWIK", "KURKA"]);
    expect(parsed.data.bbox).toEqual([14.1, 49.1, 24.1, 54.9]);
  });

  it("normalizes a single species to an array (Express 5 query shape)", () => {
    const parsed = occurrenceCellFilterSchema.safeParse({ zoom: "9", species: "BOROWIK" });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.species).toEqual(["BOROWIK"]);
  });

  // Fail closed: without a zoom the server would have to guess a grid step, and
  // a silent default would silently change what the map means.
  it("rejects a query with no zoom", () => {
    expect(occurrenceCellFilterSchema.safeParse({ bbox: "14,49,24,55" }).success).toBe(false);
  });

  it("rejects a zoom outside Leaflet's range", () => {
    expect(occurrenceCellFilterSchema.safeParse({ zoom: "-1" }).success).toBe(false);
    expect(occurrenceCellFilterSchema.safeParse({ zoom: "40" }).success).toBe(false);
  });

  // A fractional zoom is a legitimate Leaflet value once zoomSnap drops below 1.
  // cellStepForZoom floors it, so the schema lets it through instead of 400ing.
  it("accepts a fractional zoom", () => {
    const parsed = occurrenceCellFilterSchema.safeParse({ zoom: "9.5" });

    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.zoom).toBe(9.5);
  });

  it("rejects a non-numeric zoom", () => {
    expect(occurrenceCellFilterSchema.safeParse({ zoom: "abc" }).success).toBe(false);
  });

  it("rejects an unknown species", () => {
    expect(
      occurrenceCellFilterSchema.safeParse({ zoom: "9", species: "MUCHOMOR" }).success,
    ).toBe(false);
  });

  it("rejects a malformed bbox", () => {
    expect(occurrenceCellFilterSchema.safeParse({ zoom: "9", bbox: "14,49" }).success).toBe(false);
  });
});
