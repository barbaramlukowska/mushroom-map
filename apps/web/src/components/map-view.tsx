"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Sighting } from "@runo-map/shared";
import { buildApiQuery, parseDaysParam, parseSpeciesParam } from "@/lib/filter-params";
import { LoaderCircle } from "lucide-react";
import { LOADING_BANNER_DELAY_MS, WAKING_THRESHOLD_MS, loadingStage, type LoadingStage } from "@/lib/loading-stage";
import { ReportForm } from "./report-form";

// Sightings are immutable once reported, so the id list fully identifies a
// result set.
function sameSightings(a: Sighting[], b: Sighting[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((sighting, index) => sighting.id === b[index].id);
}

// Leaflet touches `window` on import, so the map must never render on the server.
const SightingsMap = dynamic(
  () => import("./sightings-map").then((mod) => mod.SightingsMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-dvh items-center justify-center text-content-muted">
        Wczytywanie mapy…
      </div>
    ),
  },
);

// Owns the sightings data: fetches client-side whenever filters (URL) or the
// visible map area (bbox) change, plus after a new report. Old pins stay on
// screen during a refetch (stale-while-revalidate); a separate error flag keeps
// the initial "not loaded yet" state from rendering the error banner.
// A staged loading banner (see lib/loading-stage.ts) covers slow fetches during Render cold starts.
export function MapView() {
  const searchParams = useSearchParams();
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [loadStage, setLoadStage] = useState<LoadingStage>("hidden");
  const [bbox, setBbox] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);

  const handleBboxChange = useCallback((next: string) => setBbox(next), []);
  const handleReported = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    // No fetch until the map reports its first bounds.
    if (bbox === null) return;

    const species = parseSpeciesParam(searchParams.getAll("species"));
    const days = parseDaysParam(searchParams.get("days") ?? undefined);
    const query = buildApiQuery(species, days, new Date(), bbox);

    // Escalate the banner as the fetch drags on. Timers never fire early, so
    // each one can derive its stage straight from its own delay. The stage is
    // deliberately not reset when a new fetch replaces an aborted one — that
    // keeps the banner steady during rapid map movement instead of flickering.
    const stageTimers = [LOADING_BANNER_DELAY_MS, WAKING_THRESHOLD_MS].map((delay) =>
      setTimeout(() => setLoadStage(loadingStage(delay)), delay),
    );
    const clearStageTimers = () => {
      for (const timer of stageTimers) clearTimeout(timer);
    };

    // Abort the previous in-flight request before starting the next one so
    // rapid map movement can't land results out of order.
    const controller = new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sightings?${query}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Bad response");
        const data = (await res.json()) as Sighting[];
        clearStageTimers();
        setLoadStage("hidden");
        // Keeping the previous array when the result set is unchanged (common
        // when zooming inside an already-loaded area) spares the map a marker
        // rebuild, which would restart the cluster animation.
        setSightings((previous) => (sameSightings(previous, data) ? previous : data));
        setFetchFailed(false);
      })
      .catch((error) => {
        // Aborts are expected during rapid movement — not an API failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
        clearStageTimers();
        setLoadStage("hidden");
        setFetchFailed(true);
      });

    return () => {
      controller.abort();
      clearStageTimers();
    };
  }, [searchParams, bbox, reloadKey]);

  return (
    <>
      {!fetchFailed && loadStage !== "hidden" && (
        <div
          role="status"
          className="fixed left-1/2 top-18 z-modal flex max-w-[90vw] -translate-x-1/2 items-center gap-2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm text-content"
        >
          <LoaderCircle size={16} className="shrink-0 animate-spin" aria-hidden="true" />
          <span>
            {loadStage === "loading"
              ? "Wczytywanie zgłoszeń…"
              : "Serwer budzi się po drzemce — pierwsze wczytanie może potrwać do minuty 🍄"}
          </span>
        </div>
      )}
      {fetchFailed && (
        <div
          role="alert"
          className="fixed left-1/2 top-18 z-modal -translate-x-1/2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-sm"
        >
          Nie udało się pobrać zgłoszeń — sprawdź, czy API działa.
        </div>
      )}
      <SightingsMap
        sightings={sightings}
        onMapClick={setPendingLocation}
        onBboxChange={handleBboxChange}
      />
      {pendingLocation && (
        <ReportForm
          location={pendingLocation}
          onClose={() => setPendingLocation(null)}
          onReported={handleReported}
        />
      )}
    </>
  );
}
