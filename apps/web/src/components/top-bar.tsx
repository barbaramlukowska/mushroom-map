"use client";

import { useState } from "react";
import { AboutModal } from "./about-modal";
import { RunoLogo } from "./icons/runo-logo";
import { Button } from "@/components/ui/button";

// z-index 600: above the filter panel (500), below modals (1000).
export function TopBar() {
  const [legendOpen, setLegendOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-topbar border-b border-line/40 bg-surface/93 backdrop-blur-[20px]">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <RunoLogo />
          <span className="font-serif text-xl tracking-wide text-content">Runo Map</span>
          <span className="hidden border-l border-line/40 pl-3 text-xs font-light uppercase tracking-widest text-content-muted sm:inline">
            Polska
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={legendOpen}
            aria-controls="legend-panel"
            className="rounded-sm border-line/50 text-xs uppercase tracking-widest text-content-muted hover:bg-fill/10 hover:text-content-muted"
            onClick={() => setLegendOpen(!legendOpen)}
          >
            Legenda
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="hidden text-xs uppercase tracking-widest text-content-muted hover:bg-transparent hover:text-content md:inline-flex"
            onClick={() => setAboutOpen(true)}
          >
            O aplikacji
          </Button>
        </div>
      </div>

      {/* Disclosure legend expanding from the bar; colors match the map pins. */}
      <div id="legend-panel" hidden={!legendOpen} className="border-t border-line/30 px-6 py-4">
        <div className="mx-auto max-w-3xl">
          <p className="mb-3 text-xs font-medium uppercase tracking-widest text-content-muted">
            Wiek zgłoszenia
          </p>
          <div className="h-1.5 rounded-xs bg-linear-to-r from-fresh via-recent to-stale" />
          <div className="mt-1.5 flex justify-between text-xs font-light">
            <span className="text-content">Świeże — dziś</span>
            <span className="text-content-soft">3 dni</span>
            <span className="text-content-muted">tydzień</span>
            <span className="text-content-muted">starsze</span>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-xs font-light text-content">
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full bg-fresh" /> Świeże (do 3 dni)
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-recent" /> Ostatnie (3–7 dni)
            </span>
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-stale" /> Starsze (ponad tydzień)
            </span>
            <span className="flex items-center gap-2">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-fresh text-[8px] font-semibold text-inverse">
                12
              </span>
              Klaster — wiele zgłoszeń
            </span>
          </div>
          <p className="mt-3 text-xs font-light text-content-soft">
            Po wybraniu gatunku, kolor pinezki oznacza gatunek — ciemne to świeże zgłoszenia, blade
            to starsze.
          </p>
        </div>
      </div>
      </header>
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
