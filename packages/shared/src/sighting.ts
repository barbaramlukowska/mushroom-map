import { z } from "zod";
import { SPECIES, type Species } from "./species.js";

// Validates new-sighting input on the frontend form AND the API request body.
export const sightingInputSchema = z.object({
  species: z.enum(SPECIES),
  lat: z.number().min(49).max(55), // Poland's latitude range
  lng: z.number().min(14).max(24.2),
  foundAt: z.iso.datetime(),
  comment: z.string().max(280).optional(),
});

export type SightingInput = z.infer<typeof sightingInputSchema>;

// "minLng,minLat,maxLng,maxLat" — the order Leaflet's map.getBounds().toBBoxString() emits.
export const bboxSchema = z
  .string()
  .regex(/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/, "Expected bbox as minLng,minLat,maxLng,maxLat")
  .transform((value) => value.split(",").map(Number) as [number, number, number, number])
  .refine(([minLng, minLat, maxLng, maxLat]) => minLng < maxLng && minLat < maxLat, {
    error: "bbox min must be less than max",
  });

// Query params for listing sightings (map filters) — all optional.
export const sightingFilterSchema = z.object({
  // Express 5's query parser yields a string for ?species=A and an array
  // for ?species=A&species=B — accept both, normalize to an array.
  species: z
    .union([z.enum(SPECIES), z.array(z.enum(SPECIES))])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional(),
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  bbox: bboxSchema.optional(),
});

export type SightingFilter = z.infer<typeof sightingFilterSchema>;

// Dates travel as ISO strings (JSON has no Date type); Prisma introduces Date objects in stage 2.
export interface Sighting {
  id: string;
  species: Species;
  lat: number;
  lng: number;
  foundAt: string;
  comment?: string;
  createdAt: string;
}
