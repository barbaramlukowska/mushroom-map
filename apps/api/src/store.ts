import { randomUUID } from "node:crypto";
import {
  buildSpeciesStats,
  type Sighting,
  type SightingFilter,
  type SightingInput,
  type SpeciesStat,
} from "@runo-map/shared";

// Async because production data lives behind the network (Prisma + PostgreSQL).
export interface Store {
  list(filter?: SightingFilter): Promise<Sighting[]>;
  getById(id: string): Promise<Sighting | undefined>;
  add(input: SightingInput): Promise<Sighting>;
  listSpeciesStats(): Promise<SpeciesStat[]>;
}

const inBbox = (s: Sighting, [minLng, minLat, maxLng, maxLat]: [number, number, number, number]) =>
  s.lng >= minLng && s.lng <= maxLng && s.lat >= minLat && s.lat <= maxLat;

// In-memory implementation — used by tests; production uses createPrismaStore.
// Factory (like createApp) so each test gets an isolated instance.
export function createStore(seed: Sighting[] = []): Store {
  const sightings: Sighting[] = [...seed];

  return {
    async list(filter: SightingFilter = {}): Promise<Sighting[]> {
      return sightings.filter(
        (s) =>
          (!filter.species || filter.species.includes(s.species)) &&
          (!filter.from || s.foundAt >= filter.from) &&
          (!filter.to || s.foundAt <= filter.to) &&
          (!filter.bbox || inBbox(s, filter.bbox)),
      );
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
    // its color and its place in the filter list as the map moves.
    async listSpeciesStats(): Promise<SpeciesStat[]> {
      const counts = new Map<string, number>();
      for (const s of sightings) {
        counts.set(s.species, (counts.get(s.species) ?? 0) + 1);
      }
      return buildSpeciesStats([...counts].map(([species, count]) => ({ species, count })));
    },
  };
}
