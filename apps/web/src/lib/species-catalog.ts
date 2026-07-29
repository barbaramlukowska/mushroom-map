import type { SpeciesRef } from "@runo-map/shared";

// Fetched once by MapView and passed down: the form, the filter list and the cell
// panel all need the same rows.
export async function fetchSpeciesCatalog(signal?: AbortSignal): Promise<SpeciesRef[]> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/species`, { signal });
  if (!res.ok) throw new Error("Bad response");
  return (await res.json()) as SpeciesRef[];
}

export function buildSpeciesLookup(list: SpeciesRef[]): Map<number, SpeciesRef> {
  return new Map(list.map((ref) => [ref.taxonKey, ref]));
}

// A key with no catalogue row means the catalogue moved on while a report kept
// its species — say so rather than render a blank line.
export function speciesLabel(ref: SpeciesRef | undefined): string {
  if (!ref) return "Nieznany gatunek";
  return ref.namePl ?? ref.scientificName;
}

// A-Z by the name the row actually shows, with Polish collation so ą/ć/ł/ż land
// where a Pole expects. The API orders by popularity, which is the right default
// for data but not for a 250-row picker: alphabetical is the order you can scan.
export function sortSpeciesByName(list: SpeciesRef[]): SpeciesRef[] {
  return [...list].sort((a, b) => speciesLabel(a).localeCompare(speciesLabel(b), "pl"));
}

// Stripped on both sides: on a phone people type "zolciak". NFD covers every Polish
// letter except ł — a stroked l is its own character, not base + combining mark.
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Mn}/gu, "")
    .replace(/ł/gi, "l")
    .toLowerCase();
}

export function matchesSpeciesQuery(ref: SpeciesRef, query: string): boolean {
  const needle = fold(query.trim());
  if (needle === "") return true;
  return fold(`${ref.namePl ?? ""} ${ref.scientificName}`).includes(needle);
}
