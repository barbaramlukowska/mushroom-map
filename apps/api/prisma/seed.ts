import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { speciesRefSchema } from "@runo-map/shared";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { demoSeed } from "../src/seed.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// From a committed artifact, not from GBIF (OWASP A03). Validated again here
// because a file on disk is still input.
const species = speciesRefSchema
  .array()
  .parse(JSON.parse(readFileSync(new URL("./species-ref.json", import.meta.url), "utf8")));

// notIn below would match every row against an empty list, wiping the catalogue.
if (species.length === 0) throw new Error("species-ref.json is empty — refusing to seed");

// upsert, not createMany: a rerun after a monthly refresh must update names and
// counts, not skip rows it already knows.
for (const ref of species) {
  await prisma.speciesRef.upsert({
    where: { taxonKey: ref.taxonKey },
    create: ref,
    update: ref,
  });
}
console.log(`Seeded ${species.length} species reference row(s)`);

// Reconcile, don't only add. Without this a species dropped from the artifact keeps
// its row forever, isProtected included — the app would go on claiming legal
// protection the regulation does not give. Rows a report points at must survive the
// foreign key, so those only lose the flag.
const stale = await prisma.speciesRef.findMany({
  where: { taxonKey: { notIn: species.map((ref) => ref.taxonKey) } },
  select: { taxonKey: true, scientificName: true, isProtected: true },
});

if (stale.length > 0) {
  const reported = new Set(
    (
      await prisma.sighting.findMany({
        where: { speciesKey: { in: stale.map((row) => row.taxonKey) } },
        select: { speciesKey: true },
        distinct: ["speciesKey"],
      })
    ).map((row) => row.speciesKey),
  );

  const kept = stale.filter((row) => reported.has(row.taxonKey));
  const removable = stale.filter((row) => !reported.has(row.taxonKey));

  for (const row of kept.filter((r) => r.isProtected)) {
    await prisma.speciesRef.update({
      where: { taxonKey: row.taxonKey },
      data: { isProtected: false },
    });
  }
  if (removable.length > 0) {
    await prisma.speciesRef.deleteMany({
      where: { taxonKey: { in: removable.map((row) => row.taxonKey) } },
    });
  }

  console.log(
    `Removed ${removable.length} species no longer in the catalogue ` +
      `(${removable.map((r) => r.scientificName).join(", ")})`,
  );
  if (kept.length > 0) {
    console.log(
      `Kept ${kept.length} with reports, protection flag cleared: ` +
        kept.map((r) => r.scientificName).join(", "),
    );
  }
}

// Sightings second: speciesKey is a foreign key, so its target has to exist first.
// skipDuplicates makes reruns safe: rows with existing ids are ignored.
const { count } = await prisma.sighting.createMany({
  data: demoSeed,
  skipDuplicates: true,
});
console.log(`Seeded ${count} sighting(s)`);

await prisma.$disconnect();
