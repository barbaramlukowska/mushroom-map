"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface AboutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AboutModal({ open, onOpenChange }: AboutModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-2xl border-line/30 bg-surface/95 shadow-panel backdrop-blur-lg sm:max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif text-lg font-normal text-content">
            Runo Map
          </DialogTitle>
          <DialogDescription className="text-xs text-content-muted">
            Społecznościowa mapa grzybów w Polsce
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-xs text-content">
          <p>
            <span className="font-semibold">Przeglądaj zgłoszenia</span> — sprawdź, gdzie ostatnio
            sypnęło grzybami.
          </p>
          <p>
            <span className="font-semibold">Zgłoś znalezisko</span> — kliknij mapę i podziel się
            obserwacją. Bez konta, anonimowo.
          </p>
          <p>
            <span className="font-semibold">Filtruj</span> — po gatunku i dacie znalezienia.
          </p>
          <p>
            Mapa grupuje zgłoszenia w obszary. W kółku wpisana jest liczba zgłoszeń, a jego
            kolor mówi, jak dawno było ostatnie: ciemne to świeże, blade to starsze.
            Kliknij kółko, żeby zobaczyć poszczególne zgłoszenia.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
