import {
  aggregateCells,
  buildSpeciesStats,
  type OccurrenceCell,
  type Sighting,
  type SightingFilter,
} from "@runo-map/shared";
import type { PrismaClient, Sighting as SightingRow } from "./generated/prisma/client.js";
import type { Store } from "./store.js";

// DB rows carry Date objects and nullable fields; the API contract
// (shared Sighting) uses ISO strings and optional fields.
function toSighting(row: SightingRow): Sighting {
  return {
    id: row.id,
    species: row.species,
    lat: row.lat,
    lng: row.lng,
    foundAt: row.foundAt.toISOString(),
    comment: row.comment ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

// Destructuring [] yields undefined bounds, which Prisma ignores in `where`.
function toWhere(filter: SightingFilter) {
  const [minLng, minLat, maxLng, maxLat] = filter.bbox ?? [];
  return {
    species: filter.species ? { in: filter.species } : undefined,
    foundAt: { gte: filter.from, lte: filter.to },
    lat: { gte: minLat, lte: maxLat },
    lng: { gte: minLng, lte: maxLng },
  };
}

export function createPrismaStore(prisma: PrismaClient): Store {
  return {
    async list(filter: SightingFilter = {}) {
      const rows = await prisma.sighting.findMany({ where: toWhere(filter) });
      return rows.map(toSighting);
    },
    async getById(id) {
      const row = await prisma.sighting.findUnique({ where: { id } });
      return row ? toSighting(row) : undefined;
    },
    async add(input) {
      return toSighting(await prisma.sighting.create({ data: input }));
    },
    async listSpeciesStats() {
      const groups = await prisma.sighting.groupBy({
        by: ["species"],
        _count: { _all: true },
      });
      return buildSpeciesStats(
        groups.map((group) => ({ species: group.species, count: group._count._all })),
      );
    },
    // Aggregation happens in JS through the shared aggregateCells, the same way
    // listSpeciesStats shares buildSpeciesStats. Grouping by a computed cell key
    // in the database would need $queryRaw — raw SQL on a path that takes client
    // input — and the only gain would be fewer rows between DB and API. Today
    // GET /api/sightings already reads these same rows and ships them all the way
    // to the browser, so this is strictly less data movement than the status quo.
    async listOccurrenceCells(filter: SightingFilter, step: number): Promise<OccurrenceCell[]> {
      const rows = await prisma.sighting.findMany({
        where: toWhere(filter),
        select: { species: true, lat: true, lng: true, foundAt: true },
        // Without an explicit order Postgres may return identical queries in a
        // different row order, which reorders the aggregated array. map-view's
        // sameCells compares index-wise and would read that as new data.
        orderBy: [{ lat: "asc" }, { lng: "asc" }, { foundAt: "asc" }],
      });
      return aggregateCells(
        rows.map((row) => ({
          id: "",
          species: row.species,
          lat: row.lat,
          lng: row.lng,
          foundAt: row.foundAt.toISOString(),
          createdAt: "",
        })),
        step,
      );
    },
    async ping(): Promise<void> {
      await prisma.$queryRaw`SELECT 1`;
    },
  };
}
