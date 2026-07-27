// Validated for map use (all-pairs CVD + >=3:1 on the map surface). The order is
// the safety mechanism — never reorder, never extend. A fifth color (#d6249f)
// was dropped: it puts the worst CVD pair at dE 7.8, inside the band that is
// only legal with a secondary channel (labels or texture), and pins carry
// neither. These four clear the band outright at dE 8.0.
export const SPECIES_COLOR_PALETTE = ["#2a78d6", "#c2410c", "#0f8a57", "#4a3aa7"] as const;

export const SPECIES_COLOR_BUDGET = SPECIES_COLOR_PALETTE.length;

// One entry per unique species, carrying how often it was reported.
export interface SpeciesTally {
  species: string;
  count: number;
}

// What the API serves per species: how often it was reported, plus its color if
// it made the budget. `color` is absent for species outside it.
export interface SpeciesStat {
  species: string;
  count: number;
  color?: string;
}

// Most-reported species win the palette, and the same order drives the filter
// list — so the colored species are exactly its top rows, which needs no
// explaining in the UI. Ties broken alphabetically, so neither the order nor the
// color of a species wobbles between two requests over unchanged data.
export function buildSpeciesStats(tallies: SpeciesTally[]): SpeciesStat[] {
  return [...tallies]
    .sort((a, b) => b.count - a.count || a.species.localeCompare(b.species))
    .map(({ species, count }, index) => {
      const color: string | undefined =
        index < SPECIES_COLOR_BUDGET ? SPECIES_COLOR_PALETTE[index] : undefined;
      return { species, count, color };
    });
}
