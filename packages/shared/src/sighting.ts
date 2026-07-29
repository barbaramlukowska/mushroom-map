import { z } from "zod";

// Validates new-sighting input on the frontend form AND the API request body.
export const sightingInputSchema = z.object({
  speciesKey: z.number().int().positive(), // GBIF species key; existence checked by the API
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

// Express 5 yields a string for ?speciesKey=1 and an array for repeats — accept
// both, normalize to an array, coerce because query values are strings. Exported:
// occurrenceCellFilterSchema needs the identical rule.
export const speciesKeyFilter = z
  .union([z.coerce.number().int().positive(), z.array(z.coerce.number().int().positive())])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .optional();

// Query params for listing sightings (map filters) — all optional.
export const sightingFilterSchema = z.object({
  speciesKey: speciesKeyFilter,
  from: z.iso.datetime().optional(),
  to: z.iso.datetime().optional(),
  bbox: bboxSchema.optional(),
});

export type SightingFilter = z.infer<typeof sightingFilterSchema>;

// Dates travel as ISO strings (JSON has no Date type).
export interface Sighting {
  id: string;
  speciesKey: number;
  lat: number;
  lng: number;
  foundAt: string;
  comment?: string;
  createdAt: string;
}
