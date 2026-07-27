"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SPECIES, SPECIES_LABELS, type Species, type SpeciesStat } from "@runo-map/shared";
import { speciesColorMap } from "@/lib/species-colors";
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

// Disclosure panel (not a modal): the map behind it stays interactive.
export function FilterPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [stats, setStats] = useState<SpeciesStat[]>([]);

  // Desktop starts expanded; mobile stays collapsed so the map is visible.
  useEffect(() => {
    if (window.matchMedia("(min-width: 768px)").matches) setOpen(true);
  }, []);

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

  const speciesColors = speciesColorMap(stats);
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
        onClick={() => setOpen(!open)}
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
                  {/* Slot stays even without a color, so every name lines up. */}
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={
                      speciesColors[species] ? { background: speciesColors[species] } : undefined
                    }
                  />
                  <span className="flex-1">
                    <span className="block text-xs font-medium leading-tight text-content">
                      {SPECIES_LABELS[species].pl}
                    </span>
                    <span className="block text-latin">
                      {SPECIES_LABELS[species].latin}
                    </span>
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
