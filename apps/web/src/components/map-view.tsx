"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { cellStepForZoom, type OccurrenceCell } from "@runo-map/shared";
import { buildCellsQuery, parseDaysParam, parseSpeciesParam, presetToFromParam } from "@/lib/filter-params";
import { LoaderCircle } from "lucide-react";
import { LOADING_BANNER_DELAY_MS, WAKING_THRESHOLD_MS, loadingStage, type LoadingStage } from "@/lib/loading-stage";
import { CellDetails } from "./cell-details";
import { FilterPanel } from "./filter-panel";
import { ReportForm } from "./report-form";

// Cells have no ids — the whole set is derived from the current filter — so a
// cheap value comparison replaces the old id-list check.
function sameCells(a: OccurrenceCell[], b: OccurrenceCell[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (cell, index) =>
      cell.lat === b[index].lat &&
      cell.lng === b[index].lng &&
      cell.count === b[index].count &&
      cell.newestFoundAt === b[index].newestFoundAt,
  );
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
// visible map area (bbox) change, plus after a new report. Old cells stay on
// screen during a refetch (stale-while-revalidate); a separate error flag keeps
// the initial "not loaded yet" state from rendering the error banner.
// A staged loading banner (see lib/loading-stage.ts) covers slow fetches during Render cold starts.
export function MapView() {
  const searchParams = useSearchParams();
  const [cells, setCells] = useState<OccurrenceCell[]>([]);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [loadStage, setLoadStage] = useState<LoadingStage>("hidden");
  const [view, setView] = useState<{ bbox: string; zoom: number } | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [openCell, setOpenCell] = useState<OccurrenceCell | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  // Zero cells after a successful fetch is a real answer, not a failure — but a
  // blank map reads as one, so it has to be said out loud. `hasLoadedOnce` guards
  // against the cold-load flash: the loading banner is deliberately delayed, so
  // `loadStage` stays "hidden" for the first stretch of every fetch, and without
  // this guard the empty banner would show before any response has landed.
  const isEmpty =
    !fetchFailed && loadStage === "hidden" && view !== null && cells.length === 0 && hasLoadedOnce;

  const handleViewChange = useCallback((next: { bbox: string; zoom: number }) => setView(next), []);
  const handleReported = useCallback(() => setReloadKey((key) => key + 1), []);

  // Memoized so the fetch effect below doesn't refire on every render.
  const selectedSpecies = useMemo(
    () => parseSpeciesParam(searchParams.getAll("species")),
    [searchParams],
  );

  // A cell only exists relative to a filter and a zoom. When either changes the
  // open panel would describe a circle that is no longer on the map.
  useEffect(() => {
    setOpenCell(null);
  }, [searchParams, view?.zoom]);

  useEffect(() => {
    // No fetch until the map reports its first bounds and zoom.
    if (view === null) return;

    const days = parseDaysParam(searchParams.get("days") ?? undefined);
    const query = buildCellsQuery(selectedSpecies, days, new Date(), view.bbox, view.zoom);

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
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/occurrence-cells?${query}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Bad response");
        const data = (await res.json()) as OccurrenceCell[];
        clearStageTimers();
        setLoadStage("hidden");
        setCells((previous) => (sameCells(previous, data) ? previous : data));
        setFetchFailed(false);
        setHasLoadedOnce(true);
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
  }, [searchParams, selectedSpecies, view, reloadKey]);

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
      {isEmpty && (
        <div
          role="status"
          className="fixed left-1/2 top-18 z-modal max-w-[90vw] -translate-x-1/2 rounded-lg border border-line-strong bg-surface px-4 py-2 text-center text-sm text-content"
        >
          Brak zgłoszeń w tym obszarze i okresie. Poszerz zakres czasu albo oddal mapę.
        </div>
      )}
      <SightingsMap
        cells={cells}
        // The zoom the cells were fetched at, so the circles are drawn for the
        // grid they actually describe. Undefined until the map reports its first
        // view, and there are no cells to draw before that.
        zoom={view?.zoom}
        onCellClick={setOpenCell}
        onMapClick={setPendingLocation}
        onViewChange={handleViewChange}
      />
      {/* Rendered here, not beside MapView, because below md it and the cell
          panel are the same bottom sheet and one of them has to stand down. */}
      <FilterPanel cellPanelOpen={openCell !== null} onOpenOnMobile={() => setOpenCell(null)} />
      {openCell && view && (
        <CellDetails
          cell={openCell}
          step={cellStepForZoom(view.zoom)}
          species={selectedSpecies}
          from={presetToFromParam(
            parseDaysParam(searchParams.get("days") ?? undefined),
            new Date(),
          )}
          viewportBbox={view.bbox}
          onClose={() => setOpenCell(null)}
        />
      )}
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
