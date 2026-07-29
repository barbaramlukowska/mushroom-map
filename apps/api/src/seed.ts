import type { Sighting, SpeciesRef } from "@runo-map/shared";

// The eight species the app shipped with — enough for the default app instance and
// the supertest suite; real data comes from prisma/species-ref.json. Counts mirror
// that artifact, including the null (GBIF has no Polish records for L. deliciosus).
export const demoSpecies: SpeciesRef[] = [
  { taxonKey: 5954958, scientificName: "Boletus edulis", namePl: "Borowik szlachetny", occurrenceCount: 1179, isProtected: false },
  { taxonKey: 7832732, scientificName: "Imleria badia", namePl: "Podgrzybek brunatny", occurrenceCount: 1190, isProtected: false },
  { taxonKey: 5249504, scientificName: "Cantharellus cibarius", namePl: "Pieprznik jadalny", occurrenceCount: 618, isProtected: false },
  { taxonKey: 7777157, scientificName: "Suillus luteus", namePl: "Maślak zwyczajny", occurrenceCount: 263, isProtected: false },
  { taxonKey: 9141390, scientificName: "Leccinum scabrum", namePl: "Koźlarz babka", occurrenceCount: 378, isProtected: false },
  { taxonKey: 5248629, scientificName: "Lactarius deliciosus", namePl: "Mleczaj rydz", occurrenceCount: null, isProtected: false },
  { taxonKey: 2536891, scientificName: "Armillaria mellea", namePl: "Opieńka miodowa", occurrenceCount: 252, isProtected: false },
  { taxonKey: 8914748, scientificName: "Macrolepiota procera", namePl: "Czubajka kania", occurrenceCount: 897, isProtected: false },
];

// Demo data for local development — real data comes from the DB in stage 2.
export const demoSeed: Sighting[] = [
  {
    id: "seed-1",
    speciesKey: 5954958, // Boletus edulis
    lat: 52.13,
    lng: 21.24,
    foundAt: "2026-07-05T00:00:00.000Z",
    comment: "Kabaty forest, near the black trail",
    createdAt: "2026-07-05T18:20:00.000Z",
  },
  {
    id: "seed-2",
    speciesKey: 5249504, // Cantharellus cibarius
    lat: 52.35,
    lng: 20.79,
    foundAt: "2026-07-08T00:00:00.000Z",
    createdAt: "2026-07-08T09:05:00.000Z",
  },
];
