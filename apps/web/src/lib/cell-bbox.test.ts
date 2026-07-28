import { describe, expect, it } from "vitest";
import type { OccurrenceCell, Sighting } from "@runo-map/shared";
import { cellBbox, intersectBbox, isInCell } from "./cell-bbox";

function cell(lat: number, lng: number): OccurrenceCell {
  return { lat, lng, count: 1, newestFoundAt: "2026-07-20T00:00:00.000Z" };
}

function sighting(lat: number, lng: number): Sighting {
  return {
    id: "id-1",
    species: "BOROWIK",
    lat,
    lng,
    foundAt: "2026-07-20T00:00:00.000Z",
    createdAt: "2026-07-20T10:00:00.000Z",
  };
}

describe("cellBbox", () => {
  it("spans half a step either side of the centre, in Leaflet's order", () => {
    const [minLng, minLat, maxLng, maxLat] = cellBbox(cell(52.005, 21.005), 0.01)
      .split(",")
      .map(Number);

    expect(minLng).toBeCloseTo(21.0, 9);
    expect(minLat).toBeCloseTo(52.0, 9);
    expect(maxLng).toBeCloseTo(21.01, 9);
    expect(maxLat).toBeCloseTo(52.01, 9);
  });
});

describe("intersectBbox", () => {
  it("keeps the tighter bound on every side", () => {
    expect(intersectBbox("20,52,22,54", "21,51,23,53")).toBe("21,52,22,53");
  });

  it("returns the cell bbox untouched when the viewport contains it", () => {
    expect(intersectBbox("21,52,21.01,52.01", "14,49,24,55")).toBe("21,52,21.01,52.01");
  });

  it("falls back to the cell bbox when there is no viewport", () => {
    expect(intersectBbox("21,52,21.01,52.01", undefined)).toBe("21,52,21.01,52.01");
  });

  it("falls back to the cell bbox when the viewport is malformed", () => {
    expect(intersectBbox("21,52,21.01,52.01", "nonsense")).toBe("21,52,21.01,52.01");
  });

  // An open panel survives a pan (map-view only closes it on filter/zoom change),
  // so its cell can end up entirely off screen. bboxSchema refines on STRICT
  // minLng < maxLng && minLat < maxLat, so an inverted or zero-width bbox is a
  // 400 from /api/sightings — the caller must be told "no overlap" instead.
  it("returns null when the cell is above the viewport in latitude", () => {
    expect(intersectBbox("21,53,21.01,53.01", "20,49,22,52")).toBeNull();
  });

  it("returns null when the cell is beside the viewport in longitude", () => {
    expect(intersectBbox("23,52,23.01,52.01", "20,49,22,55")).toBeNull();
  });

  it("returns null when the cell only touches the viewport edge (zero width)", () => {
    expect(intersectBbox("22,52,22.01,52.01", "20,49,22,55")).toBeNull();
  });

  it("returns null when the cell only touches the viewport edge (zero height)", () => {
    expect(intersectBbox("21,52,21.01,52.01", "20,49,23,52")).toBeNull();
  });

  it("still returns the overlap when the cell straddles the viewport edge", () => {
    expect(intersectBbox("21.99,52,22.01,52.02", "20,49,22.005,55")).toBe("21.99,52,22.005,52.02");
  });
});

describe("isInCell", () => {
  // Cells bin half-open — [i*step, (i+1)*step) — while a bbox query is inclusive
  // at both ends. Coordinates are stored on the 0.005 grid and every step is a
  // multiple of it, so boundary values are real: 52.01 is returned by the query
  // for the cell centred at 52.005 but belongs to the one centred at 52.015.
  it("rejects a sighting sitting exactly on the cell's upper boundary", () => {
    expect(isInCell(sighting(52.01, 21.005), cell(52.005, 21.005), 0.01)).toBe(false);
  });

  it("accepts a sighting sitting exactly on the cell's lower boundary", () => {
    expect(isInCell(sighting(52.0, 21.0), cell(52.005, 21.005), 0.01)).toBe(true);
  });

  it("accepts a sighting inside the cell", () => {
    expect(isInCell(sighting(52.005, 21.005), cell(52.005, 21.005), 0.01)).toBe(true);
  });

  it("claims the boundary coordinate for exactly one of the two neighbouring cells", () => {
    const lower = cell(52.005, 21.005);
    const upper = cell(52.015, 21.005);
    const onBoundary = sighting(52.01, 21.005);

    expect([isInCell(onBoundary, lower, 0.01), isInCell(onBoundary, upper, 0.01)]).toEqual([
      false,
      true,
    ]);
  });
});
