import { z } from "zod";

// A curated macrofungus reference row (fed from GBIF, cached in our DB).
// namePl is null when no Polish name was found (UI falls back to scientificName).
export const speciesRefSchema = z.object({
  taxonKey: z.number().int().positive(),
  scientificName: z.string().min(1),
  namePl: z.string().min(1).nullable(),
  occurrenceCount: z.number().int().nonnegative().nullable(),
  isProtected: z.boolean(),
});

export type SpeciesRef = z.infer<typeof speciesRefSchema>;

// ---- Import-pipeline validators (untrusted external responses) ----

// GBIF species/{key}: only the fields the pipeline reads. Fungi kingdomKey is 5,
// so a literal here is what stops a non-fungus from ever reaching our DB.
export const gbifSpeciesSchema = z.object({
  key: z.number().int().positive(),
  scientificName: z.string().min(1),
  canonicalName: z.string().min(1),
  kingdomKey: z.literal(5),
  rank: z.string(),
});

// GBIF species/match. Only the key is read — species/{key} + gbifSpeciesSchema do
// the real vetting. acceptedUsageKey appears when the name is a synonym and is the
// one to prefer: facets count accepted taxa, so the synonym would duplicate a row.
export const gbifMatchSchema = z.object({
  usageKey: z.number().int().positive(),
  acceptedUsageKey: z.number().int().positive().optional(),
});

// GBIF species/{key}/vernacularNames entry.
export const gbifVernacularSchema = z.object({
  vernacularName: z.string().min(1),
  language: z.string(),
});

// GBIF occurrence/search facet count (speciesKey → occurrenceCount).
export const gbifFacetSchema = z.object({
  name: z.string(),
  count: z.number().int().nonnegative(),
});

// Wikidata SPARQL binding for the batched Polish-label lookup: ?gbif is the
// P846 value we asked for, ?itemLabel the label the service returned.
export const wikidataBindingSchema = z.object({
  gbif: z.object({ value: z.string().min(1) }),
  itemLabel: z.object({ value: z.string().min(1), "xml:lang": z.string() }),
});
