"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SpeciesRef, SpeciesStat } from "@runo-map/shared";
import { reportCountLabel } from "@/lib/report-count-label";
import { speciesLabel } from "@/lib/species-catalog";
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
  // Reported species only, most-reported first — the API's order is the list order.
  // Fetched by MapView so these rows and the map's filter cannot disagree.
  stats: SpeciesStat[];
  // Key -> names + protection flag.
  lookup: Map<number, SpeciesRef>;
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
export function FilterPanel({
  stats,
  lookup,
  cellPanelOpen = false,
  onOpenOnMobile,
}: FilterPanelProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

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

  // Derived from the prop, not a fourth one: panel and map read the same array.
  const reportedKeys = useMemo(() => new Set(stats.map((stat) => stat.speciesKey)), [stats]);

  const selected = parseSpeciesParam(searchParams.getAll("speciesKey"), reportedKeys);
  const days = parseDaysParam(searchParams.get("days") ?? undefined);

  const applyFilters = (speciesKeys: number[], nextDays: DayPreset) => {
    const query = buildPageQuery(speciesKeys, nextDays);
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const toggleSpecies = (key: number) => {
    const next = selected.includes(key)
      ? selected.filter((selectedKey) => selectedKey !== key)
      : [...selected, key];
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
            {/* Only reported species: filtering by one nobody reported could
                only ever empty the map. The API already returns them
                most-reported first, so this order needs no client-side sort. */}
            {stats.length === 0 && (
              <p className="px-4 pb-3 text-xs text-content-muted">
                Nie ma jeszcze żadnych zgłoszeń.
              </p>
            )}
            {stats.map((stat) => {
              const ref = lookup.get(stat.speciesKey);
              const isSelected = selected.includes(stat.speciesKey);
              return (
                <label
                  key={stat.speciesKey}
                  htmlFor={`species-${stat.speciesKey}`}
                  className={`flex cursor-pointer items-center gap-3 border-b border-line/20 px-4 py-3 transition-colors last:border-b-0 ${
                    isSelected ? "bg-fill/10" : "hover:bg-fill/5"
                  }`}
                >
                  <Checkbox
                    id={`species-${stat.speciesKey}`}
                    checked={isSelected}
                    onCheckedChange={() => toggleSpecies(stat.speciesKey)}
                  />
                  <span className="flex-1">
                    <span className="block text-xs font-medium leading-tight text-content">
                      {speciesLabel(ref)}
                    </span>
                    <span className="block text-latin">{ref?.scientificName ?? ""}</span>
                  </span>
                  {ref?.isProtected && (
                    <span className="shrink-0 rounded-full bg-fill/10 px-2 py-0.5 text-[10px] font-medium text-content-soft">
                      pod ochroną
                    </span>
                  )}
                  {/* Report count, never a species colour — no mark on the map is
                      coloured by species, so a dot would point at nothing. */}
                  <span
                    className="shrink-0 text-xs font-medium tabular-nums text-content-muted"
                    aria-label={reportCountLabel(stat.count)}
                  >
                    {stat.count}
                  </span>
                </label>
              );
            })}
          </fieldset>
        </div>
      </aside>
    </>
  );
}
