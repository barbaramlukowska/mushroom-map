import { SPECIES, type Species } from "@runo-map/shared";

export type DayPreset = 3 | 7 | 14 | "all";
export const DAY_PRESETS: readonly DayPreset[] = [3, 7, 14, "all"];

// Value shapes of Next.js searchParams entries and URLSearchParams.getAll().
type ParamValue = string | string[] | undefined;

const isSpecies = (value: string): value is Species =>
  (SPECIES as readonly string[]).includes(value);

// Unknown species in a hand-edited link are dropped, not errors.
export function parseSpeciesParam(value: ParamValue): Species[] {
  const list = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return list.filter(isSpecies);
}

// Absent or unrecognized → "all" (the no-filter default).
export function parseDaysParam(value: ParamValue): DayPreset {
  const raw = Array.isArray(value) ? value[0] : value;
  const days = Number(raw);
  return days === 3 || days === 7 || days === 14 ? days : "all";
}

// UTC midnight (N-1) days back: preset N covers N calendar days including
// today — consistent with foundAt always being UTC midnight.
export function presetToFromParam(days: DayPreset, now: Date): string | undefined {
  if (days === "all") return undefined;
  const from = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (days - 1)),
  );
  return from.toISOString();
}

// Query string MapView forwards to GET /api/occurrence-cells. bbox is the visible
// map area (Leaflet's toBBoxString); null before the map reports its first bounds.
// zoom is always sent: the server derives the grid step from it and refuses a
// request without one, so a circle can never silently change meaning.
export function buildCellsQuery(
  species: Species[],
  days: DayPreset,
  now: Date,
  bbox: string | null,
  zoom: number,
): string {
  const params = new URLSearchParams();
  params.set("zoom", String(zoom));
  for (const s of species) params.append("species", s);
  const from = presetToFromParam(days, now);
  if (from) params.set("from", from);
  if (bbox) params.set("bbox", bbox);
  return params.toString();
}

// Query string for the page URL — days stays a preset ("all" = no param).
export function buildPageQuery(species: Species[], days: DayPreset): string {
  const params = new URLSearchParams();
  for (const s of species) params.append("species", s);
  if (days !== "all") params.set("days", String(days));
  return params.toString();
}
