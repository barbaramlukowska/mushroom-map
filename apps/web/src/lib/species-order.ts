import type { Species, SpeciesStat } from "@runo-map/shared";

// The API already sorts stats most-reported first, so its index is the rank.
// Species nobody reported yet keep their original order at the end, which keeps
// the filter list from reshuffling as the first reports trickle in.
export function sortSpeciesByReports(
  species: readonly Species[],
  stats: SpeciesStat[],
): Species[] {
  const rank = new Map(stats.map((stat, index) => [stat.species, index]));
  return species
    .map((name, index) => ({ name, key: rank.get(name) ?? stats.length + index }))
    .sort((a, b) => a.key - b.key)
    .map((entry) => entry.name);
}
