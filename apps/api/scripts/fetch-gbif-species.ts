// Builds prisma/species-ref.json from GBIF + Wikidata. Dev-only: nothing in src/
// imports it and the API never calls GBIF at runtime — species data reaches
// production only through a reviewed diff of the committed JSON (OWASP A03).
//
// Run: pnpm --filter @runo-map/api fetch-species
import { readFileSync, writeFileSync } from "node:fs";
import {
  gbifFacetSchema,
  gbifMatchSchema,
  gbifSpeciesSchema,
  gbifVernacularSchema,
  speciesRefSchema,
  wikidataBindingSchema,
  type SpeciesRef,
} from "@runo-map/shared";

const GBIF = "https://api.gbif.org/v1";
const WIKIDATA = "https://query.wikidata.org/sparql";

// Agaricomycetes — macrofungi. Narrower than kingdom Fungi on purpose: ranking all
// fungi by record count is dominated by moulds and rusts nobody picks.
const AGARICOMYCETES_KEY = 186;

// A starting point, not a law — recalibrate once the real ranking is visible.
const POPULAR_LIMIT = 150;

// The eight species the app shipped with (see the species_ref migration). Unioned
// in even if unpopular, so no existing report loses its FK target.
const LEGACY_KEYS = [5954958, 7832732, 5249504, 7777157, 9141390, 5248629, 2536891, 8914748];

const USER_AGENT = "runo-map-species-fetch/1.0 (+https://github.com/barbaramlukowska/runo-map)";
const THROTTLE_MS = 120;

// Keys per Wikidata query. One request per ~120 species instead of one each:
// WDQS throttles hard, and 250+ single lookups get cut off mid-run.
const WIKIDATA_CHUNK = 120;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// One retry on "too fast" / "try again", then give up: a half-fetched run must
// never overwrite a good artifact.
async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    await sleep(attempt === 0 ? THROTTLE_MS : 3000);
    const res = await fetch(url, {
      ...init,
      headers: { "User-Agent": USER_AGENT, Accept: "application/json", ...init?.headers },
    });
    if (res.ok) return (await res.json()) as unknown;
    if (res.status !== 429 && res.status < 500) {
      throw new Error(`${url} responded ${res.status}`);
    }
  }
  throw new Error(`${url} kept failing after a retry`);
}

function readJsonFile(relativePath: string): unknown {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as unknown;
}

// The committed inputs are ours, but a typo would quietly change the artifact.
function readProtectedNames(): string[] {
  const raw = readJsonFile("../prisma/protected-species.json");
  if (typeof raw !== "object" || raw === null || !("species" in raw) || !Array.isArray(raw.species)) {
    throw new Error("protected-species.json: expected an object with a species array");
  }
  const names = raw.species.filter((name): name is string => typeof name === "string");
  if (names.length !== raw.species.length) {
    throw new Error("protected-species.json: every entry must be a scientific name string");
  }
  return names;
}

function readOverrides(): Record<string, string> {
  const raw = readJsonFile("../prisma/pl-overrides.json");
  if (typeof raw !== "object" || raw === null || !("names" in raw)) {
    throw new Error("pl-overrides.json: expected an object with a names map");
  }
  const names = raw.names;
  if (typeof names !== "object" || names === null || Array.isArray(names)) {
    throw new Error("pl-overrides.json: names must be an object");
  }
  const result: Record<string, string> = {};
  for (const [latin, polish] of Object.entries(names)) {
    if (typeof polish !== "string") throw new Error(`pl-overrides.json: ${latin} must map to a string`);
    result[latin] = polish;
  }
  return result;
}

// speciesKey -> Polish record count. The popularity signal that picks the
// catalogue and orders it.
async function fetchFacets(limit: number): Promise<Map<number, number>> {
  const url = `${GBIF}/occurrence/search?country=PL&taxonKey=${AGARICOMYCETES_KEY}&facet=speciesKey&facetLimit=${limit}&limit=0`;
  const body = await fetchJson(url);
  if (
    typeof body !== "object" ||
    body === null ||
    !("facets" in body) ||
    !Array.isArray(body.facets) ||
    body.facets.length === 0
  ) {
    throw new Error("GBIF occurrence/search returned no facets");
  }
  const first: unknown = body.facets[0];
  if (typeof first !== "object" || first === null || !("counts" in first) || !Array.isArray(first.counts)) {
    throw new Error("GBIF occurrence/search facet has no counts");
  }

  const counts = new Map<number, number>();
  for (const entry of first.counts) {
    // A malformed entry means the response shape moved — a broken run, not a
    // species to skip.
    const facet = gbifFacetSchema.parse(entry);
    const key = Number(facet.name);
    if (!Number.isInteger(key) || key <= 0) throw new Error(`GBIF facet name is not a key: ${facet.name}`);
    counts.set(key, facet.count);
  }
  return counts;
}

// A protected name GBIF cannot resolve is a mistake in our list — fail loudly
// rather than drop the badge silently. Each match is followed to its accepted
// taxon: 20 regulation names are synonyms today, and facets count accepted keys,
// so keeping the synonym would duplicate the row and badge the wrong one.
async function matchProtectedKeys(names: string[]): Promise<Map<number, string>> {
  const keys = new Map<number, string>();
  for (const name of names) {
    const url = `${GBIF}/species/match?name=${encodeURIComponent(name)}&kingdom=Fungi`;
    const parsed = gbifMatchSchema.safeParse(await fetchJson(url));
    if (!parsed.success) {
      throw new Error(`GBIF cannot match protected species "${name}" — fix protected-species.json`);
    }
    keys.set(parsed.data.acceptedUsageKey ?? parsed.data.usageKey, name);
  }
  return keys;
}

// null when the key is not an accepted Fungi species. gbifSpeciesSchema enforces
// kingdomKey === 5, so nothing outside Fungi reaches our DB.
async function fetchSpecies(key: number) {
  const parsed = gbifSpeciesSchema.safeParse(await fetchJson(`${GBIF}/species/${key}`));
  if (!parsed.success || parsed.data.rank !== "SPECIES") return null;
  return parsed.data;
}

// GBIF's vernacular names are inconsistently cased ("muchomor czerwony" next to
// "Borowik szlachetny"). Only the first letter is touched.
function capitalize(name: string): string {
  const trimmed = name.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

async function fetchGbifPolishName(key: number): Promise<string | null> {
  const body = await fetchJson(`${GBIF}/species/${key}/vernacularNames?limit=300`);
  if (typeof body !== "object" || body === null || !("results" in body) || !Array.isArray(body.results)) {
    return null;
  }
  for (const entry of body.results) {
    const parsed = gbifVernacularSchema.safeParse(entry);
    if (parsed.success && parsed.data.language === "pol") return parsed.data.vernacularName;
  }
  return null;
}

// Wikidata links taxa to GBIF through P846, which makes it a second source of
// Polish names — GBIF itself knows one for barely half the list. All keys are
// asked for in a few batched queries; see WIKIDATA_CHUNK.
async function fetchWikidataPolishNames(keys: number[]): Promise<Map<number, string>> {
  const names = new Map<number, string>();

  for (let start = 0; start < keys.length; start += WIKIDATA_CHUNK) {
    const chunk = keys.slice(start, start + WIKIDATA_CHUNK);
    const values = chunk.map((key) => `"${key}"`).join(" ");
    const query = `SELECT ?gbif ?itemLabel WHERE { VALUES ?gbif { ${values} } ?item wdt:P846 ?gbif. SERVICE wikibase:label { bd:serviceParam wikibase:language "pl". } }`;
    const body = await fetchJson(WIKIDATA, {
      method: "POST",
      headers: {
        Accept: "application/sparql-results+json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ query }).toString(),
    });

    if (typeof body !== "object" || body === null || !("results" in body)) {
      throw new Error("Wikidata returned no results block");
    }
    const results = body.results;
    if (typeof results !== "object" || results === null || !("bindings" in results) || !Array.isArray(results.bindings)) {
      throw new Error("Wikidata results carry no bindings");
    }

    for (const binding of results.bindings) {
      const parsed = wikidataBindingSchema.safeParse(binding);
      if (!parsed.success) continue;
      // Without a Polish label the service falls back to the Latin name tagged
      // en — taking that would put "Imleria badia" in the namePl column.
      if (parsed.data.itemLabel["xml:lang"] !== "pl") continue;
      const key = Number(parsed.data.gbif.value);
      if (Number.isInteger(key)) names.set(key, parsed.data.itemLabel.value);
    }
  }

  return names;
}

// A "Polish name" equal to the Latin binomial carries no information — the UI
// already prints the scientific name on its own line, and Wikidata is full of
// them. Rejecting it here lets the cascade move on.
function usableName(candidate: string | null | undefined, scientificName: string): string | null {
  if (!candidate) return null;
  const name = capitalize(candidate);
  return name.toLowerCase() === scientificName.toLowerCase() ? null : name;
}

// Our overrides first, then GBIF, then Wikidata, then null. Overrides lead because
// they are human decisions: last place would make them gap-fillers only, unable to
// correct bad upstream data (GBIF's mid-word capital in "Błyskoporek Podkorowy").
// null is a real answer — the UI falls back to the scientific name.
async function resolvePolishName(
  key: number,
  scientificName: string,
  wikidata: Map<number, string>,
  overrides: Record<string, string>,
): Promise<string | null> {
  const override = usableName(overrides[scientificName], scientificName);
  if (override) return override;

  const fromGbif = usableName(await fetchGbifPolishName(key), scientificName);
  if (fromGbif) return fromGbif;

  return usableName(wikidata.get(key), scientificName);
}

async function main() {
  const overrides = readOverrides();
  const protectedNames = readProtectedNames();
  const protectedLatin = new Set(protectedNames.map((name) => name.toLowerCase()));

  console.log(`Fetching the ${POPULAR_LIMIT} most-recorded macrofungi in Poland…`);
  const facetCounts = await fetchFacets(POPULAR_LIMIT);

  console.log(`Resolving ${protectedNames.length} protected species…`);
  const protectedKeys = await matchProtectedKeys(protectedNames);

  // Union, not intersection: a protected species belongs in the catalogue however
  // rarely it is recorded, and it may sit outside Agaricomycetes entirely (the
  // morels are Pezizomycetes), where the facet query would never find it.
  const keys = [...new Set([...facetCounts.keys(), ...protectedKeys.keys(), ...LEGACY_KEYS])];

  console.log(`Looking up Polish names on Wikidata for ${keys.length} keys…`);
  const wikidataNames = await fetchWikidataPolishNames(keys);

  console.log(`Reading ${keys.length} species records…`);
  const records: SpeciesRef[] = [];
  const skipped: number[] = [];
  for (const key of keys) {
    const species = await fetchSpecies(key);
    if (!species) {
      // A curated entry that quietly disappears is worse than a failed run: the
      // badge would stop showing and nobody would know why.
      if (protectedKeys.has(key) || LEGACY_KEYS.includes(key)) {
        throw new Error(`GBIF has no accepted Fungi species record for curated key ${key}`);
      }
      skipped.push(key);
      continue;
    }

    records.push(
      speciesRefSchema.parse({
        taxonKey: species.key,
        scientificName: species.canonicalName,
        namePl: await resolvePolishName(key, species.canonicalName, wikidataNames, overrides),
        // null for a protected species outside the popular list — unknown, not zero.
        occurrenceCount: facetCounts.get(key) ?? null,
        // Either the name came from our list, or GBIF's canonical name is on it.
        isProtected:
          protectedKeys.has(key) || protectedLatin.has(species.canonicalName.toLowerCase()),
      }),
    );
  }

  // Never trade a good artifact for a thin one: a GBIF hiccup that made most
  // records unreadable would otherwise silently shrink the catalogue.
  if (records.length < keys.length / 2) {
    throw new Error(`Only ${records.length} of ${keys.length} species validated — refusing to write`);
  }

  // Most-recorded first (the combobox order), unknown counts last. Name as the
  // tie-break so the file is byte-stable and the monthly PR shows real changes only.
  records.sort(
    (a, b) =>
      (b.occurrenceCount ?? -1) - (a.occurrenceCount ?? -1) ||
      a.scientificName.localeCompare(b.scientificName),
  );

  writeFileSync(
    new URL("../prisma/species-ref.json", import.meta.url),
    `${JSON.stringify(records, null, 2)}\n`,
  );

  const named = records.filter((record) => record.namePl !== null).length;
  console.log(
    `Wrote ${records.length} species to prisma/species-ref.json ` +
      `(${named} with a Polish name, ${records.filter((r) => r.isProtected).length} protected, ` +
      `${skipped.length} keys skipped as non-species).`,
  );
}

await main();
