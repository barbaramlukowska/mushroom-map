import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "./app.js";
import { demoSpecies } from "./seed.js";
import { createStore } from "./store.js";

// GBIF keys of the species the default store knows (see demoSpecies). Named here
// so an assertion reads as a species rather than as a seven-digit number.
const BOROWIK = 5954958; // Boletus edulis
const KURKA = 5249504; // Cantharellus cibarius
const RYDZ = 5248629; // Lactarius deliciosus
const MASLAK = 7777157; // Suillus luteus
const KANIA = 8914748; // Macrolepiota procera
const UNKNOWN_KEY = 99999999;

describe("GET /api/sightings", () => {
  it("responds 200 with a list of sightings", async () => {
    const app = createApp();

    const res = await request(app).get("/api/sightings");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toMatchObject({
      id: expect.any(String),
      speciesKey: expect.any(Number),
      lat: expect.any(Number),
      lng: expect.any(Number),
      foundAt: expect.any(String),
    });
  });
});

describe("GET /api/species", () => {
  it("serves the reference list sorted by popularity", async () => {
    const res = await request(createApp()).get("/api/species");

    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(1);
    expect(res.body[0].occurrenceCount).toBeGreaterThanOrEqual(res.body[1].occurrenceCount);
  });

  it("carries the fields the UI needs per row", async () => {
    const res = await request(createApp()).get("/api/species");

    expect(res.body[0]).toMatchObject({
      taxonKey: expect.any(Number),
      scientificName: expect.any(String),
      isProtected: expect.any(Boolean),
    });
  });

  it("sinks a species with no GBIF count to the end, not to the front", async () => {
    const res = await request(createApp()).get("/api/species");

    expect(res.body.at(-1).occurrenceCount).toBeNull();
  });

  it("responds with an empty list when no species are known", async () => {
    const res = await request(createApp(createStore([]))).get("/api/species");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("POST /api/sightings", () => {
  const validInput = {
    speciesKey: RYDZ,
    lat: 53.42,
    lng: 14.55,
    foundAt: "2026-07-09T00:00:00.000Z",
    comment: "spruce forest near Szczecin",
  };

  it("creates a sighting and responds 201 with it", async () => {
    const app = createApp();

    const res = await request(app).post("/api/sightings").send(validInput);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject(validInput);
    expect(res.body.id).toEqual(expect.any(String));
    expect(res.body.createdAt).toEqual(expect.any(String));
  });

  it("adds the created sighting to the list", async () => {
    const app = createApp();

    await request(app).post("/api/sightings").send(validInput);
    const res = await request(app).get("/api/sightings");

    expect(res.body.map((s: { speciesKey: number }) => s.speciesKey)).toContain(RYDZ);
  });

  it("rounds coordinates to ~500 m before saving (location privacy)", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/sightings")
      .send({ ...validInput, lat: 53.4271, lng: 14.5538 });

    expect(res.body.lat).toBe(53.425);
    expect(res.body.lng).toBe(14.555);
  });

  it("responds 400 for a speciesKey that is not in the catalogue", async () => {
    const app = createApp();

    const res = await request(app).post("/api/sightings").send({ ...validInput, speciesKey: UNKNOWN_KEY });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Unknown species");
  });

  it("responds 400 with issues for a speciesKey that is not a positive integer", async () => {
    const app = createApp();

    const res = await request(app).post("/api/sightings").send({ ...validInput, speciesKey: "BOROWIK" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
  });

  it("responds 400 for coordinates outside Poland", async () => {
    const app = createApp();

    const res = await request(app)
      .post("/api/sightings")
      .send({ ...validInput, lat: 35.0 });

    expect(res.status).toBe(400);
  });
});

describe("GET /api/sightings/:id", () => {
  it("responds 200 with the sighting for a known id", async () => {
    const res = await request(createApp()).get("/api/sightings/seed-1");

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "seed-1", speciesKey: BOROWIK });
  });

  it("responds 404 for an unknown id", async () => {
    const res = await request(createApp()).get("/api/sightings/no-such-id");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

describe("GET /api/species-stats", () => {
  it("responds 200 with one entry per seeded species, keyed by speciesKey", async () => {
    const res = await request(createApp()).get("/api/species-stats");

    expect(res.status).toBe(200);
    // Both seeded species have one report, so the tie-break by key decides:
    // Cantharellus cibarius (5249504) before Boletus edulis (5954958).
    expect(res.body).toEqual([
      { speciesKey: KURKA, count: 1 },
      { speciesKey: BOROWIK, count: 1 },
    ]);
  });

  it("no longer serves a color field", async () => {
    const res = await request(createApp()).get("/api/species-stats");

    for (const stat of res.body) {
      expect(stat).not.toHaveProperty("color");
    }
  });

  it("responds with an empty list when nothing has been reported", async () => {
    const res = await request(createApp(createStore([], demoSpecies))).get("/api/species-stats");

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("orders most-reported first so the filter panel can follow the payload", async () => {
    const app = createApp();

    for (let i = 0; i < 2; i++) {
      await request(app).post("/api/sightings").send({
        speciesKey: MASLAK,
        lat: 52.2,
        lng: 21.1,
        foundAt: "2026-07-20T00:00:00.000Z",
      });
    }
    const res = await request(app).get("/api/species-stats");

    expect(res.body[0]).toMatchObject({ speciesKey: MASLAK, count: 2 });
  });

  it("moves the leading spot to a species that overtakes on count", async () => {
    const app = createApp();
    const countOf = (body: { speciesKey: number; count: number }[], key: number) =>
      body.find((s) => s.speciesKey === key)?.count;

    for (let i = 0; i < 3; i++) {
      await request(app).post("/api/sightings").send({
        speciesKey: MASLAK,
        lat: 52.2,
        lng: 21.1,
        foundAt: "2026-07-20T00:00:00.000Z",
      });
    }
    const res = await request(app).get("/api/species-stats");

    expect(res.body[0].speciesKey).toBe(MASLAK);
    expect(countOf(res.body, MASLAK)).toBe(3);
    expect(countOf(res.body, BOROWIK)).toBe(1);
  });
});

describe("GET /api/sightings filters", () => {
  it("filters by species key", async () => {
    const res = await request(createApp()).get(`/api/sightings?speciesKey=${KURKA}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].speciesKey).toBe(KURKA);
  });

  it("filters by multiple species keys (repeated query key)", async () => {
    const res = await request(createApp()).get(
      `/api/sightings?speciesKey=${KURKA}&speciesKey=${BOROWIK}`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((s: { speciesKey: number }) => s.speciesKey).sort()).toEqual(
      [KURKA, BOROWIK].sort(),
    );
  });

  it("responds 400 when one of multiple species keys is not a number", async () => {
    const res = await request(createApp()).get(`/api/sightings?speciesKey=${KURKA}&speciesKey=SMERF`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
  });

  // An unknown-but-numeric key is a filter that matches nothing, not bad input:
  // the catalogue can legitimately move on while an old link keeps its key.
  it("returns an empty list for a numeric key nothing was reported under", async () => {
    const res = await request(createApp()).get(`/api/sightings?speciesKey=${UNKNOWN_KEY}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("filters by foundAt date range", async () => {
    // seed-1 found 2026-07-05, seed-2 found 2026-07-08
    const res = await request(createApp()).get(
      "/api/sightings?from=2026-07-07T00:00:00.000Z&to=2026-07-09T00:00:00.000Z",
    );

    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("seed-2");
  });

  it("responds 400 for a non-numeric species filter", async () => {
    const res = await request(createApp()).get("/api/sightings?speciesKey=SMERF");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
  });

  it("filters by bbox (only sightings inside the visible map area)", async () => {
    // seed-1 at lng 21.24 / lat 52.13; seed-2 at lng 20.79 / lat 52.35
    const res = await request(createApp()).get("/api/sightings?bbox=21,52,21.5,52.2");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe("seed-1");
  });

  it("responds 400 for a malformed bbox", async () => {
    const res = await request(createApp()).get("/api/sightings?bbox=not-a-bbox");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
  });

  it("responds 400 when bbox min exceeds max", async () => {
    const res = await request(createApp()).get("/api/sightings?bbox=21.5,52,21,52.2");

    expect(res.status).toBe(400);
  });
});

describe("rate limiting", () => {
  it("responds 429 after 10 sightings from one IP within the window", async () => {
    const app = createApp();

    for (let i = 0; i < 10; i++) {
      const ok = await request(app).post("/api/sightings").send({
        speciesKey: KANIA,
        lat: 51.1,
        lng: 17.03,
        foundAt: "2026-07-09T00:00:00.000Z",
      });
      expect(ok.status).toBe(201);
    }

    const blocked = await request(app).post("/api/sightings").send({
      speciesKey: KANIA,
      lat: 51.1,
      lng: 17.03,
      foundAt: "2026-07-09T00:00:00.000Z",
    });

    expect(blocked.status).toBe(429);
  });

  it("does not rate-limit reads", async () => {
    const app = createApp();

    for (let i = 0; i < 15; i++) {
      const res = await request(app).get("/api/sightings");
      expect(res.status).toBe(200);
    }
  });
});

describe("error handling", () => {
  it("responds 500 with a generic message when a route throws", async () => {
    const brokenStore = {
      list() {
        throw new Error("db exploded: secret connection string leaked");
      },
      add() {
        throw new Error("db exploded");
      },
      getById() {
        throw new Error("db exploded");
      },
      listSpeciesStats() {
        throw new Error("db exploded");
      },
      listSpecies() {
        throw new Error("db exploded");
      },
      speciesExists() {
        throw new Error("db exploded");
      },
      listOccurrenceCells() {
        throw new Error("db exploded");
      },
      ping() {
        throw new Error("db exploded");
      },
    };
    const app = createApp(brokenStore);

    const res = await request(app).get("/api/sightings");

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: "Internal server error" });
    // the real error message must never reach the client
    expect(JSON.stringify(res.body)).not.toContain("secret");
  });

  it("responds 404 as JSON for unknown routes", async () => {
    const app = createApp();

    const res = await request(app).get("/api/nonsense");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: "Not found" });
  });
});

describe("security headers", () => {
  it("does not reveal Express via X-Powered-By", async () => {
    const res = await request(createApp()).get("/api/health");

    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("sets basic security headers via helmet", async () => {
    const res = await request(createApp()).get("/api/health");

    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("trusts a single proxy layer (Render reverse proxy)", () => {
    const app = createApp();
    expect(app.get("trust proxy")).toBe(1);
  });
});

describe("GET /api/health", () => {
  it("responds 200 with status ok", async () => {
    const app = createApp();

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("responds 500 when the database ping fails (keep-alive should retry, not assume health)", async () => {
    const brokenStore = {
      list: async () => [],
      getById: async () => undefined,
      add: async () => {
        throw new Error("db exploded");
      },
      listSpeciesStats: async () => [],
      listSpecies: async () => [],
      speciesExists: async () => false,
      listOccurrenceCells: async () => [],
      ping: async () => {
        throw new Error("db exploded");
      },
    };
    const app = createApp(brokenStore);

    const res = await request(app).get("/api/health");

    expect(res.status).toBe(500);
  });
});

describe("CORS", () => {
  it("allows the configured web origin", async () => {
    const res = await request(createApp())
      .get("/api/sightings")
      .set("Origin", "http://localhost:3000");

    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });

  it("does not allow a foreign origin", async () => {
    const res = await request(createApp())
      .get("/api/sightings")
      .set("Origin", "http://evil.example.com");

    expect(res.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("answers the CORS preflight (OPTIONS) for POST", async () => {
    const res = await request(createApp())
      .options("/api/sightings")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "POST");

    expect(res.status).toBe(204);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
  });
});

describe("GET /api/occurrence-cells", () => {
  const base = {
    speciesKey: BOROWIK,
    foundAt: "2026-07-20T00:00:00.000Z",
    createdAt: "2026-07-20T10:00:00.000Z",
  };

  it("responds 200 with aggregated cells", async () => {
    const app = createApp(
      createStore([
        { ...base, id: "a", lat: 52.0, lng: 21.0 },
        { ...base, id: "b", lat: 52.03, lng: 21.03 },
      ]),
    );

    const res = await request(app).get("/api/occurrence-cells?zoom=9");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({
      lat: expect.any(Number),
      lng: expect.any(Number),
      count: 2,
      newestFoundAt: "2026-07-20T00:00:00.000Z",
    });
  });

  it("never returns individual sighting ids or comments", async () => {
    const app = createApp(
      createStore([{ ...base, id: "secret-id", lat: 52.0, lng: 21.0, comment: "przy leśniczówce" }]),
    );

    const res = await request(app).get("/api/occurrence-cells?zoom=9");

    expect(Object.keys(res.body[0]).sort()).toEqual(["count", "lat", "lng", "newestFoundAt"]);
  });

  it("splits into more cells at a deeper zoom", async () => {
    const store = createStore([
      { ...base, id: "a", lat: 52.0, lng: 21.0 },
      { ...base, id: "b", lat: 52.09, lng: 21.0 },
    ]);

    const coarse = await request(createApp(store)).get("/api/occurrence-cells?zoom=5");
    const fine = await request(createApp(store)).get("/api/occurrence-cells?zoom=9");

    expect(coarse.body).toHaveLength(1);
    expect(fine.body).toHaveLength(2);
  });

  it("filters by species key before aggregating", async () => {
    const app = createApp(
      createStore([
        { ...base, id: "a", lat: 52.0, lng: 21.0, speciesKey: BOROWIK },
        { ...base, id: "b", lat: 52.03, lng: 21.03, speciesKey: KURKA },
      ]),
    );

    const res = await request(app).get(`/api/occurrence-cells?zoom=9&speciesKey=${BOROWIK}`);

    expect(res.body).toHaveLength(1);
    expect(res.body[0].count).toBe(1);
  });

  it("accepts a repeated speciesKey param", async () => {
    const app = createApp(
      createStore([
        { ...base, id: "a", lat: 52.0, lng: 21.0, speciesKey: BOROWIK },
        { ...base, id: "b", lat: 52.03, lng: 21.03, speciesKey: KURKA },
        { ...base, id: "c", lat: 52.04, lng: 21.04, speciesKey: MASLAK },
      ]),
    );

    const res = await request(app).get(
      `/api/occurrence-cells?zoom=9&speciesKey=${BOROWIK}&speciesKey=${KURKA}`,
    );

    expect(res.body[0].count).toBe(2);
  });

  it("responds 400 when zoom is missing", async () => {
    const res = await request(createApp()).get("/api/occurrence-cells");

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid input");
    expect(Array.isArray(res.body.issues)).toBe(true);
  });

  it("responds 400 for an out-of-range zoom", async () => {
    const res = await request(createApp()).get("/api/occurrence-cells?zoom=99");

    expect(res.status).toBe(400);
  });

  it("responds 400 for a non-numeric species key", async () => {
    const res = await request(createApp()).get("/api/occurrence-cells?zoom=9&speciesKey=MUCHOMOR");

    expect(res.status).toBe(400);
  });

  it("responds 400 for a malformed bbox", async () => {
    const res = await request(createApp()).get("/api/occurrence-cells?zoom=9&bbox=14,49");

    expect(res.status).toBe(400);
  });
});
