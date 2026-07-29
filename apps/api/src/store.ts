import { randomUUID } from "node:crypto";
import {
  aggregateCells,
  buildSpeciesStats,
  type OccurrenceCell,
  type Sighting,
  type SightingFilter,
  type SightingInput,
  type SpeciesRef,
  type SpeciesStat,
} from "@runo-map/shared";

// Async because production data lives behind the network (Prisma + PostgreSQL).
export interface Store {
  list(filter?: SightingFilter): Promise<Sighting[]>;
  getById(id: string): Promise<Sighting | undefined>;
  add(input: SightingInput): Promise<Sighting>;
  listSpeciesStats(): Promise<SpeciesStat[]>;
  // Served straight to the client by GET /api/species — our own DB, never GBIF.
  listSpecies(): Promise<SpeciesRef[]>;
  // Guards the FK on POST: the client cannot insert an arbitrary speciesKey.
  speciesExists(key: number): Promise<boolean>;
  // Takes a grid step, not a zoom: turning zoom into a step is the route's job,
  // so the store never has to know what a map zoom is.
  listOccurrenceCells(filter: SightingFilter, step: number): Promise<OccurrenceCell[]>;
  // Touches the database so an external keep-alive hitting /api/health can stop
  // both Render's service spin-down and Supabase's free-tier project pause.
  ping(): Promise<void>;
}

const inBbox = (s: Sighting, [minLng, minLat, maxLng, maxLat]: [number, number, number, number]) =>
  s.lng >= minLng && s.lng <= maxLng && s.lat >= minLat && s.lat <= maxLat;

const matchesFilter = (s: Sighting, filter: SightingFilter) =>
  (!filter.speciesKey || filter.speciesKey.includes(s.speciesKey)) &&
  (!filter.from || s.foundAt >= filter.from) &&
  (!filter.to || s.foundAt <= filter.to) &&
  (!filter.bbox || inBbox(s, filter.bbox));

// In-memory implementation — used by tests; production uses createPrismaStore.
// Factory (like createApp) so each test gets an isolated instance.
export function createStore(seed: Sighting[] = [], speciesSeed: SpeciesRef[] = []): Store {
  const sightings: Sighting[] = [...seed];
  const species: SpeciesRef[] = [...speciesSeed];

  return {
    async list(filter: SightingFilter = {}): Promise<Sighting[]> {
      return sightings.filter((s) => matchesFilter(s, filter));
    },
    async getById(id: string): Promise<Sighting | undefined> {
      return sightings.find((s) => s.id === id);
    },
    async add(input: SightingInput): Promise<Sighting> {
      const sighting: Sighting = {
        id: randomUUID(),
        ...input,
        createdAt: new Date().toISOString(),
      };
      sightings.push(sighting);
      return sighting;
    },
    // Global by design: counts ignore the map's current filters, so a species keeps
    // its place in the filter list as the map moves.
    async listSpeciesStats(): Promise<SpeciesStat[]> {
      const counts = new Map<number, number>();
      for (const s of sightings) {
        counts.set(s.speciesKey, (counts.get(s.speciesKey) ?? 0) + 1);
      }
      return buildSpeciesStats([...counts].map(([speciesKey, count]) => ({ speciesKey, count })));
    },
    // nulls last: an entry with no GBIF count is the least popular thing we know.
    async listSpecies(): Promise<SpeciesRef[]> {
      return [...species].sort((a, b) => (b.occurrenceCount ?? -1) - (a.occurrenceCount ?? -1));
    },
    async speciesExists(key: number): Promise<boolean> {
      return species.some((s) => s.taxonKey === key);
    },
    // Filter first, aggregate second: a cell holds only the sightings that match
    // the current filter, so a filtered-out cell disappears from the map entirely.
    async listOccurrenceCells(filter: SightingFilter, step: number): Promise<OccurrenceCell[]> {
      return aggregateCells(
        sightings.filter((s) => matchesFilter(s, filter)),
        step,
      );
    },
    async ping(): Promise<void> {},
  };
}
