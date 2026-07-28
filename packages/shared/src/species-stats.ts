// One entry per unique species, carrying how often it was reported.
export interface SpeciesTally {
  species: string;
  count: number;
}

// What the API serves per species. There is no colour here on purpose: the map
// encodes how many reports a cell holds and how recent they are, never which
// species — see docs/superpowers/specs/2026-07-28-occurrence-areas-design.md.
// Colour as a carrier of species identity had a hard ceiling of four
// (CVD/normal-vision validation, see the 2026-07-27 spec) against a species list
// growing to ~150, so it was withdrawn rather than extended.
export interface SpeciesStat {
  species: string;
  count: number;
}

// Most-reported species first — this order drives the filter list. Ties broken
// alphabetically, so the order never wobbles between two requests over
// unchanged data.
export function buildSpeciesStats(tallies: SpeciesTally[]): SpeciesStat[] {
  return [...tallies].sort((a, b) => b.count - a.count || a.species.localeCompare(b.species));
}
