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

      {/* Disclosure legend expanding from the bar; colors match the map circles. */}
      <div id="legend-panel" hidden={!legendOpen} className="border-t border-line/30 px-6 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs font-light text-content">
            <span className="text-xs font-medium uppercase tracking-widest text-content-muted">
              Ostatnie zgłoszenie
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-cell-line bg-cell-fresh" />
              do 3 dni
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-cell-line bg-cell-recent" />
              3–7 dni
            </span>
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-full border-2 border-cell-line bg-cell-stale" />
              dawniej
            </span>
          </div>
          <p className="text-xs font-light text-content-soft">
            Brak kółka — nikt nic tu nie zgłosił w tym obszarze i w tym okresie. Nie znaczy to, że
            grzybów tam nie ma.
          </p>
          <p className="text-xs font-light text-content-muted">
            Mapa pokazuje, gdzie ludzie zgłaszają grzyby, a nie gdzie grzyby rosną — przy
            popularnych szlakach zgłoszeń jest więcej, bo więcej osób tam chodzi.
          </p>
        </div>
      </div>
      </header>
      <AboutModal open={aboutOpen} onOpenChange={setAboutOpen} />
    </>
  );
}
