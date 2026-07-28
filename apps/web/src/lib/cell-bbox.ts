import { cellKey, type OccurrenceCell, type Sighting } from "@runo-map/shared";

// Leaflet's bbox order, the one the API expects: minLng,minLat,maxLng,maxLat.
type Bounds = [number, number, number, number];

function parse(bbox: string): Bounds | null {
  const parts = bbox.split(",").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return null;
  return [parts[0], parts[1], parts[2], parts[3]];
}

// The panel asks for the sightings behind one circle. The cell knows its centre
// and the grid step, so its bounds are the centre plus/minus half a step.
export function cellBbox(cell: OccurrenceCell, step: number): string {
  const half = step / 2;
  return [cell.lng - half, cell.lat - half, cell.lng + half, cell.lat + half].join(",");
}

// The circle's count was aggregated over the sightings inside the VIEWPORT, so a
// cell straddling the screen edge counts only the visible part. Clipping the
// panel's query to the same viewport keeps the list and the number in step.
// No viewport (or an unparseable one) means no clipping — the cell bbox stands.
//
// null means the cell and the viewport do not overlap: an open panel survives a
// pan, so its cell can be moved entirely off screen. There is no bbox that can
// express that — bboxSchema refines on STRICT minLng < maxLng && minLat < maxLat,
// so an inverted or zero-width intersection would 400 and surface as a false
// error banner. The caller skips the request instead (see cell-details.tsx).
export function intersectBbox(
  cellBounds: string,
  viewportBbox: string | undefined,
): string | null {
  const cell = parse(cellBounds);
  const viewport = viewportBbox ? parse(viewportBbox) : null;
  if (!cell || !viewport) return cellBounds;

  const minLng = Math.max(cell[0], viewport[0]);
  const minLat = Math.max(cell[1], viewport[1]);
  const maxLng = Math.min(cell[2], viewport[2]);
  const maxLat = Math.min(cell[3], viewport[3]);
  // Strict, to match bboxSchema: touching edges enclose no area and no sighting.
  if (minLng >= maxLng || minLat >= maxLat) return null;

  return [minLng, minLat, maxLng, maxLat].join(",");
}

// The bbox narrows the query; this decides membership. Cells bin half-open while
// a bbox is inclusive at both ends, so a sighting exactly on a boundary comes
// back for two neighbouring cells. Re-applying the shared binning rule keeps the
// panel's list identical to what the circle counted, and keeps the rule in one
// place instead of restating the bounds here.
export function isInCell(sighting: Sighting, cell: OccurrenceCell, step: number): boolean {
  return cellKey(sighting.lat, sighting.lng, step) === cellKey(cell.lat, cell.lng, step);
}
