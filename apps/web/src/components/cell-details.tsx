"use client";

import { useEffect, useState } from "react";
import { SPECIES_LABELS, type OccurrenceCell, type Sighting, type Species } from "@runo-map/shared";
import { Button } from "@/components/ui/button";
import { cellBbox, intersectBbox, isInCell } from "@/lib/cell-bbox";
import { formatFoundAgo } from "@/lib/found-ago";
import { reportCountLabel } from "@/lib/report-count-label";

interface CellDetailsProps {
  cell: OccurrenceCell;
  step: number;
  species: Species[];
  from?: string;
  // The viewport the circle's count was aggregated over. The query is clipped to
  // it so the list can't include reports the circle never counted.
  viewportBbox?: string;
  onClose: () => void;
}

export function CellDetails({ cell, step, species, from, viewportBbox, onClose }: CellDetailsProps) {
  const [sightings, setSightings] = useState<Sighting[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // The panel stays open across a pan, so its cell can end up off screen. There
    // is no valid bbox for "no overlap" — asking anyway would 400 and show the
    // error banner — so the empty list is the honest answer without a request.
    const bbox = intersectBbox(cellBbox(cell, step), viewportBbox);
    if (bbox === null) {
      setSightings([]);
      setFailed(false);
      return;
    }

    const params = new URLSearchParams();
    params.set("bbox", bbox);
    for (const s of species) params.append("species", s);
    if (from) params.set("from", from);

    const controller = new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sightings?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Bad response");
        return (await res.json()) as Sighting[];
      })
      .then((data) => {
        // The bbox is inclusive at both ends while cells bin half-open, so the
        // response can carry reports from a neighbouring cell. Re-apply the
        // shared binning rule instead of trusting the bounds.
        const inCell = data.filter((sighting) => isInCell(sighting, cell, step));
        // Newest first: the freshest report is the one that decides the trip.
        setSightings(inCell.sort((a, b) => b.foundAt.localeCompare(a.foundAt)));
        setFailed(false);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(true);
      });
    return () => controller.abort();
  }, [cell, step, species, from, viewportBbox]);

  const now = new Date();

  return (
    <aside
      className="fixed inset-x-0 bottom-0 z-modal max-h-[60dvh] overflow-y-auto rounded-t-2xl border-t border-line/30 bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-sheet backdrop-blur-lg md:inset-x-auto md:bottom-4 md:right-4 md:w-[320px] md:rounded-xl md:border md:shadow-panel"
      aria-label="Zgłoszenia w tym obszarze"
    >
      <div className="flex items-start justify-between gap-3 p-4 pb-2">
        <div>
          <p className="text-eyebrow">Ten obszar</p>
          <h2 className="text-title">{reportCountLabel(cell.count)}</h2>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-xs font-medium text-action hover:bg-transparent"
          onClick={onClose}
        >
          Zamknij
        </Button>
      </div>

      {failed && (
        <p role="alert" className="px-4 pb-4 text-sm text-content-soft">
          Nie udało się pobrać zgłoszeń z tego obszaru.
        </p>
      )}

      {!failed && sightings === null && (
        <p className="px-4 pb-4 text-sm text-content-muted">Wczytywanie…</p>
      )}

      {sightings?.length === 0 && (
        <p className="px-4 pb-4 text-sm text-content-muted">
          Brak zgłoszeń do pokazania w tym obszarze.
        </p>
      )}

      {sightings?.map((sighting) => (
        <div key={sighting.id} className="border-t border-line/20 px-4 py-3">
          <p className="text-xs font-medium text-content">{SPECIES_LABELS[sighting.species].pl}</p>
          <p className="text-latin">{SPECIES_LABELS[sighting.species].latin}</p>
          <p className="mt-1 text-xs text-content-muted">
            znalezione {formatFoundAgo(sighting.foundAt, now)}
          </p>
          {sighting.comment && (
            <p className="mt-1 text-xs text-content-soft">{sighting.comment}</p>
          )}
        </div>
      ))}
    </aside>
  );
}
