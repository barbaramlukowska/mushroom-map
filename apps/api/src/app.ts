import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  cellStepForZoom,
  occurrenceCellFilterSchema,
  sightingFilterSchema,
  sightingInputSchema,
} from "@runo-map/shared";
import { roundCoord } from "./geo.js";
import { demoSeed } from "./seed.js";
import { createStore, type Store } from "./store.js";

// App factory — tests create their own instance without starting a real server.
export function createApp(store: Store = createStore(demoSeed)): Express {
  const app = express();

  // Behind Render's reverse proxy: read the client IP from X-Forwarded-For
  // (one proxy layer) so express-rate-limit keys on the real client, not the proxy.
  app.set("trust proxy", 1);

  app.use(helmet());
  // Browser POSTs come straight from the web app; reflect only its origin.
  // origin as an array (not a plain string) makes cors omit the header for
  // any other/absent origin instead of echoing a fixed value.
  app.use(cors({ origin: [process.env.WEB_ORIGIN ?? "http://localhost:3000"] }));
  app.use(express.json());

  app.get("/api/sightings", async (req, res) => {
    const parsed = sightingFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
      return;
    }
    res.json(await store.list(parsed.data));
  });

  app.get("/api/sightings/:id", async (req, res) => {
    const sighting = await store.getById(req.params.id);
    if (!sighting) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(sighting);
  });

  // The map's main read: reports aggregated into grid cells, one circle per cell.
  // The client sends its zoom, never a grid step — the step comes from the closed
  // CELL_STEPS ladder, so no client value reaches the aggregation.
  app.get("/api/occurrence-cells", async (req, res) => {
    const parsed = occurrenceCellFilterSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
      return;
    }
    const { zoom, ...filter } = parsed.data;
    res.json(await store.listOccurrenceCells(filter, cellStepForZoom(zoom)));
  });

  // Global (not per-view) so a species keeps its rank in the filter list as the
  // map moves. Ordered most-reported first.
  app.get("/api/species-stats", async (_req, res) => {
    res.json(await store.listSpeciesStats());
  });

  // Anti-vandalism: max 10 new sightings per IP per hour; reads stay unlimited.
  const postLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sightings, try again later" },
  });

  app.post("/api/sightings", postLimiter, async (req, res) => {
    const parsed = sightingInputSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid input", issues: parsed.error.issues });
      return;
    }
    const sighting = await store.add({
      ...parsed.data,
      lat: roundCoord(parsed.data.lat),
      lng: roundCoord(parsed.data.lng),
    });
    res.status(201).json(sighting);
  });

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // After all routes: nothing matched → JSON 404 (default would be HTML).
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  // Central error handler — Express recognizes it by the 4-argument signature.
  // Fail safe: log the real error server-side, never leak details to the client.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
