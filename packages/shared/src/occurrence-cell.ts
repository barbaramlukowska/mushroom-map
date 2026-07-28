import { z } from "zod";
import { SPECIES } from "./species.js";
import { bboxSchema } from "./sighting.js";
import type { Sighting } from "./sighting.js";

// Grid ladder, coarsest first. Every step is a whole multiple of the 0.005°
// storage grid (see apps/api/src/geo.ts roundCoord), so a cell boundary never
// falls between two stored coordinates and a sighting can't flip between cells.
// Each level halves the previous one, so zooming in splits one cell into four.
export const CELL_STEPS = [0.32, 0.16, 0.08, 0.04, 0.02, 0.01, 0.005] as const;

// The finest step equals the storage grid — there is nothing more precise to show.
const FINEST_STEP = CELL_STEPS[CELL_STEPS.length - 1];

// Leaflet zoom -> grid step. Deliberately a table and not a formula over the
// bbox: the same bbox in a taller browser window would otherwise produce
// different cells for the same view.
const STEP_BY_ZOOM: Record<number, number> = {
  7: 0.16,
  8: 0.08,
  9: 0.08,
  10: 0.04,
  11: 0.02,
  12: 0.01,
};

// Floored once at the top so every branch below sees an integer: Leaflet can
// report a fractional zoom whenever zoomSnap drops below 1, and a fractional
// value slipping past the `<= 6` branch would miss the table and fall back to
// the finest step — the exact opposite of what a zoomed-out view needs.
export function cellStepForZoom(zoom: number): number {
  const level = Math.floor(zoom);
  if (level <= 6) return CELL_STEPS[0];
  if (level >= 13) return FINEST_STEP;
  return STEP_BY_ZOOM[level] ?? FINEST_STEP;
}

// Index of the cell a coordinate falls into. floor (not round) so a cell covers
// [index * step, (index + 1) * step) — a half-open range, so no coordinate
// belongs to two cells. Rounding first kills float noise like 52.00000000001.
function cellIndex(value: number, step: number): number {
  return Math.floor(Number((value / step).toFixed(9)));
}

// "latIndex:lngIndex" — a string so it can key a Map without tuple comparison.
export function cellKey(lat: number, lng: number, step: number): string {
  return `${cellIndex(lat, step)}:${cellIndex(lng, step)}`;
}

// The centre, not the corner: the circle is drawn here, and a corner would sit
// the mark on the boundary between four cells.
export function cellCenter(key: string, step: number): { lat: number; lng: number } {
  const [latIndex, lngIndex] = key.split(":").map(Number);
  return {
    lat: (latIndex + 0.5) * step,
    lng: (lngIndex + 0.5) * step,
  };
}

// What the API serves per aggregated area: how many reports it holds and when
// the newest one was found. Position is the cell centre, never a real sighting.
export interface OccurrenceCell {
  lat: number;
  lng: number;
  count: number;
  newestFoundAt: string;
}

// Shared by both stores (see apps/api/src/store.ts and prisma-store.ts) so the
// binning rule exists once — the same reason listSpeciesStats shares
// buildSpeciesStats. foundAt is a UTC ISO string, so string comparison orders
// dates correctly and no Date objects are needed.
export function aggregateCells(sightings: Sighting[], step: number): OccurrenceCell[] {
  const byCell = new Map<string, { count: number; newestFoundAt: string }>();

  for (const sighting of sightings) {
    const key = cellKey(sighting.lat, sighting.lng, step);
    const current = byCell.get(key);
    if (!current) {
      byCell.set(key, { count: 1, newestFoundAt: sighting.foundAt });
      continue;
    }
    current.count += 1;
    if (sighting.foundAt > current.newestFoundAt) {
      current.newestFoundAt = sighting.foundAt;
    }
  }

  return [...byCell].map(([key, cell]) => ({
    ...cellCenter(key, step),
    count: cell.count,
    newestFoundAt: cell.newestFoundAt,
  }));
}

// Query params for the aggregated map view. Same filters as sightingFilterSchema
// plus a REQUIRED zoom: the grid step is derived from it, and a default step
// picked silently on the server would quietly change what a circle means.
export const occurrenceCellFilterSchema = z.object({
  // Not .int(): a fractional zoom is legitimate once zoomSnap drops below 1,
  // and cellStepForZoom floors it — rejecting it would 400 a valid view.
  zoom: z.coerce.number().min(0).max(22),
  species: z
    .union([z.enum(SPECIES), z.array(z.enum(SPECIES))])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  bbox: bboxSchema.optional(),
});

export type OccurrenceCellFilter = z.infer<typeof occurrenceCellFilterSchema>;
