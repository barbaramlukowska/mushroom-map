export type DayPreset = 3 | 7 | 14 | "all";
export const DAY_PRESETS: readonly DayPreset[] = [3, 7, 14, "all"];

// Value shapes of Next.js searchParams entries and URLSearchParams.getAll().
type ParamValue = string | string[] | undefined;

// The caller passes the keys it knows, because the species list now arrives at
// runtime. Those are the REPORTED keys, not the whole catalogue: the filter list
// only offers reported species, so a key outside that set names a row the user
// cannot untick. An empty set means no species filter — the map shows everything,
// which is also the state before the stats land.
export function parseSpeciesParam(value: ParamValue, reportedKeys: ReadonlySet<number>): number[] {
  const list = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return list.map(Number).filter((key) => Number.isInteger(key) && reportedKeys.has(key));
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
  speciesKeys: number[],
  days: DayPreset,
  now: Date,
  bbox: string | null,
  zoom: number,
): string {
  const params = new URLSearchParams();
  params.set("zoom", String(zoom));
  for (const key of speciesKeys) params.append("speciesKey", String(key));
  const from = presetToFromParam(days, now);
  if (from) params.set("from", from);
  if (bbox) params.set("bbox", bbox);
  return params.toString();
}

// Query string for the page URL — days stays a preset ("all" = no param).
export function buildPageQuery(speciesKeys: number[], days: DayPreset): string {
  const params = new URLSearchParams();
  for (const key of speciesKeys) params.append("speciesKey", String(key));
  if (days !== "all") params.set("days", String(days));
  return params.toString();
}
