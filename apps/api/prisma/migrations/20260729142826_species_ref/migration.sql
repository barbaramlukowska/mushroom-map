-- Replaces the `Species` enum with a SpeciesRef table keyed by GBIF taxonKey.
-- Expand/backfill/contract, because Sighting already holds real reports.

-- CreateTable
CREATE TABLE "SpeciesRef" (
    "taxonKey" INTEGER NOT NULL,
    "scientificName" TEXT NOT NULL,
    "namePl" TEXT,
    "occurrenceCount" INTEGER,
    "isProtected" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SpeciesRef_pkey" PRIMARY KEY ("taxonKey")
);

-- The eight species the app shipped with, so every existing report keeps an FK
-- target. Keys from GBIF species/match (all EXACT + ACCEPTED). namePl carries over
-- the deleted SPECIES_LABELS text; occurrenceCount waits for the seed.
INSERT INTO "SpeciesRef" ("taxonKey", "scientificName", "namePl") VALUES
    (5954958, 'Boletus edulis', 'Borowik szlachetny'),
    (7832732, 'Imleria badia', 'Podgrzybek brunatny'),
    (5249504, 'Cantharellus cibarius', 'Pieprznik jadalny'),
    (7777157, 'Suillus luteus', 'Maślak zwyczajny'),
    (9141390, 'Leccinum scabrum', 'Koźlarz babka'),
    (5248629, 'Lactarius deliciosus', 'Mleczaj rydz'),
    (2536891, 'Armillaria mellea', 'Opieńka miodowa'),
    (8914748, 'Macrolepiota procera', 'Czubajka kania');

-- Nullable first, so existing rows survive ADD COLUMN.
ALTER TABLE "Sighting" ADD COLUMN "speciesKey" INTEGER;

-- Backfill from the enum being retired.
UPDATE "Sighting" SET "speciesKey" = CASE "species"
    WHEN 'BOROWIK'    THEN 5954958
    WHEN 'PODGRZYBEK' THEN 7832732
    WHEN 'KURKA'      THEN 5249504
    WHEN 'MASLAK'     THEN 7777157
    WHEN 'KOZLARZ'    THEN 9141390
    WHEN 'RYDZ'       THEN 5248629
    WHEN 'OPIENKA'    THEN 2536891
    WHEN 'KANIA'      THEN 8914748
END;

-- Every row has a key now, so the constraints can go on.
ALTER TABLE "Sighting" ALTER COLUMN "speciesKey" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Sighting" ADD CONSTRAINT "Sighting_speciesKey_fkey" FOREIGN KEY ("speciesKey") REFERENCES "SpeciesRef"("taxonKey") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Sighting" DROP COLUMN "species";

-- DropEnum
DROP TYPE "Species";
