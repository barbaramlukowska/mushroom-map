"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SPECIES, SPECIES_LABELS, type Species, type SpeciesStat } from "@runo-map/shared";
import { reportCountLabel } from "@/lib/report-count-label";
import { sortSpeciesByReports } from "@/lib/species-order";
import {
  DAY_PRESETS,
  buildPageQuery,
  parseDaysParam,
  parseSpeciesParam,
  type DayPreset,
} from "@/lib/filter-params";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const DAY_LABELS: Record<DayPreset, string> = {
  3: "3 dni",
  7: "7 dni",
  14: "14 dni",
  all: "Wszystkie",
};

// z-index 500: above the map tiles (~400), below the top bar (600) and
// modals (1000), clear of the bottom-right zoom control.

// Below md both this panel and the cell panel are the same bottom sheet, so
// only one of them can be on screen at a time.
const MOBILE_QUERY = "(min-width: 768px)";

interface FilterPanelProps {
  // True while the cell panel occupies the bottom sheet.
  cellPanelOpen?: boolean;
  // Called when the user opens the filters on a screen where the two panels
  // would share the slot, so the caller can close the cell panel.
  onOpenOnMobile?: () => void;
}

function isSharedSlot() {
  return !window.matchMedia(MOBILE_QUERY).matches;
}

// Disclosure panel (not a modal): the map behind it stays interactive.
export function FilterPanel({ cellPanelOpen = false, onOpenOnMobile }: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<SpeciesStat[]>([]);

  // Desktop starts expanded; mobile stays collapsed so the map is visible.
  useEffect(() => {
    if (window.matchMedia(MOBILE_QUERY).matches) setOpen(true);
  }, []);

  // Below md the two panels are the same sheet, so the arriving one wins and
  // this one closes for real rather than hiding: a panel that is invisible but
  // still "open" makes its own toggle button do nothing on the next tap.
  useEffect(() => {
    if (cellPanelOpen && isSharedSlot()) setOpen(false);
  }, [cellPanelOpen]);

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    // Opening the filters on a shared-slot screen takes the sheet back.
    if (next && isSharedSlot()) onOpenOnMobile?.();
  };

  // The map fetches this too; it is a sibling component, so the panel asks for
  // its own copy — one row per reported species, served from the browser cache.
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/species-stats`, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error("Bad response");
        return (await res.json()) as SpeciesStat[];
      })
      .then(setStats)
      // Fail closed: no stats means no dots and the original order, matching a
      // map stuck in age mode.
      .catch(() => setStats([]));
    return () => controller.abort();
  }, []);

  // The slot that used to hold a colour dot now holds the report count. The dot
  // pointed at a species colour on the map, and after the switch to aggregated
  // cells no mark on the map is coloured by species — a coloured dot would send
  // people looking for circles that do not exist.
  const countBySpecies = new Map(stats.map((stat) => [stat.species, stat.count]));
  // Before the fetch lands there is no count to show. A hard 0 would be a false
  // statement about the data, so the slot stays empty until stats arrive.
  const hasStats = stats.length > 0;
  const orderedSpecies = sortSpeciesByReports(SPECIES, stats);

  const selected = parseSpeciesParam(searchParams.getAll("species"));
  const days = parseDaysParam(searchParams.get("days") ?? undefined);

  const applyFilters = (species: Species[], nextDays: DayPreset) => {
    const query = buildPageQuery(species, nextDays);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const toggleSpecies = (species: Species) => {
    const next = selected.includes(species)
      ? selected.filter((s) => s !== species)
      : [...selected, species];
    applyFilters(next, days);
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls="filter-panel"
        className="fixed left-4 top-18 z-panel border-line/30 bg-surface/92 text-[13px] font-semibold text-content shadow-toggle backdrop-blur-lg hover:bg-surface/92 hover:text-content"
        onClick={toggleOpen}
      >
        Filtry
      </Button>
      <aside
        id="filter-panel"
        hidden={!open}
        className="fixed inset-x-0 bottom-0 z-panel max-h-[60dvh] overflow-y-auto rounded-t-2xl border-t border-line/30 bg-surface/92 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] shadow-sheet md:inset-x-auto md:bottom-auto md:left-4 md:top-[120px] md:max-h-[calc(100dvh-136px)] md:w-[300px] md:rounded-xl md:border md:pb-0 md:shadow-panel"
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-stale md:hidden" aria-hidden="true" />
        <div className="flex items-center justify-between p-4 pb-3">
          <div>
            <p className="text-eyebrow">
              Filtry
            </p>
            <h2 className="text-title">Zgłoszenia</h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto p-0 text-xs font-medium text-action hover:bg-transparent hover:text-content-soft"
            onClick={() => applyFilters([], "all")}
          >
            Wyczyść
          </Button>
        </div>

        <fieldset className="mb-4 px-4">
          <legend className="mb-2 text-label">Zakres czasu</legend>
          <ToggleGroup
            type="single"
            value={days === "all" ? "all" : String(days)}
            onValueChange={(value) => {
              // Radix emits "" when the active item is clicked again; a preset
              // must always stay selected, so ignore deselection.
              if (value) applyFilters(selected, parseDaysParam(value));
            }}
            className="w-full gap-0.5 rounded-lg bg-line/20 p-0.5"
          >
            {DAY_PRESETS.map((preset) => (
              <ToggleGroupItem
                key={preset}
                value={String(preset)}
                className="flex-1 rounded-md py-1.5 text-xs font-medium text-content-soft data-[state=on]:bg-fill data-[state=on]:text-inverse data-[state=on]:shadow-chip"
              >
                {DAY_LABELS[preset]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </fieldset>

        <div className="border-t border-line/30">
          <fieldset>
            <legend className="px-4 pb-1 pt-3 text-label">Gatunki</legend>
            {orderedSpecies.map((species) => {
              const isSelected = selected.includes(species);
              return (
                <label
                  key={species}
                  htmlFor={`species-${species}`}
                  className={`flex cursor-pointer items-center gap-3 border-b border-line/20 px-4 py-3 transition-colors last:border-b-0 ${
                    isSelected ? "bg-fill/10" : "hover:bg-fill/5"
                  }`}
                >
                  <Checkbox
                    id={`species-${species}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleSpecies(species)}
                  />
                  <span className="flex-1">
                    <span className="block text-xs font-medium leading-tight text-content">
                      {SPECIES_LABELS[species].pl}
                    </span>
                    <span className="block text-latin">
                      {SPECIES_LABELS[species].latin}
                    </span>
                  </span>
                  {hasStats && (
                    <span
                      className="shrink-0 text-xs font-medium tabular-nums text-content-muted"
                      aria-label={reportCountLabel(countBySpecies.get(species) ?? 0)}
                    >
                      {countBySpecies.get(species) ?? 0}
                    </span>
                  )}
                </label>
              );
            })}
          </fieldset>
        </div>
      </aside>
    </>
  );
}
