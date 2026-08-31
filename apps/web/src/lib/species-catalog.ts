import type { SpeciesRef } from "@runo-map/shared";

// The API sleeps: Render's free tier spins a quiet instance down, and the first
// request after that wakes it. While it boots, the connection is refused or a 502
// comes back. One attempt is not enough — a single miss used to leave the report
// form with an empty species list until the page was reloaded.
const RETRY_DELAYS_MS = [2000, 6000, 15000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Fetched once by MapView and passed down: the form, the filter list and the cell
// panel all need the same rows.
export async function fetchSpeciesCatalog(signal?: AbortSignal): Promise<SpeciesRef[]> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/species`, { signal });
      if (!res.ok) throw new Error("Bad response");
      return (await res.json()) as SpeciesRef[];
    } catch (error) {
      if (signal?.aborted) throw error;
      if (attempt >= RETRY_DELAYS_MS.length) throw error;
      await sleep(RETRY_DELAYS_MS[attempt]);
    }
  }
}

// Three states, because the picker has three things to say. "loading" is not the
// same as "failed": the catalogue is fetched once on mount and the report form
// usually opens long after, so conflating them would show a cold start as an
// error.
export type CatalogStatus = "loading" | "ready" | "failed";

// Nothing is preselected, so the trigger is the only place the picker can admit
// that the list behind it is not there yet.
export function speciesTriggerLabel(status: CatalogStatus): string {
  if (status === "loading") return "Wczytywanie gatunków…";
  if (status === "failed") return "Nie udało się wczytać gatunków";
  return "Wybierz gatunek…";
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
