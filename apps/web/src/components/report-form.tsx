"use client";

import { useMemo, useRef, useState } from "react";
import { Controller, useForm, type Resolver } from "react-hook-form";
import { ChevronDown } from "lucide-react";
import { sightingInputSchema, type SpeciesRef } from "@runo-map/shared";
import {
  matchesSpeciesQuery,
  sortSpeciesByName,
  speciesLabel,
  speciesTriggerLabel,
  type CatalogStatus,
} from "@/lib/species-catalog";
import { toSightingInput, type ReportFormValues } from "@/lib/report-input";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

interface ReportFormProps {
  // Fetched once by MapView. Empty if that failed — the form then refuses to
  // submit rather than posting a bad key.
  catalog: SpeciesRef[];
  catalogStatus: CatalogStatus;
  onRetryCatalog: () => void;
  location: { lat: number; lng: number };
  onClose: () => void;
  onReported: () => void;
}

const FIELD_MESSAGES_PL: Record<string, string> = {
  speciesKey: "Wybierz gatunek grzyba.",
  foundAt: "Podaj poprawną datę znalezienia.",
  comment: "Komentarz może mieć maksymalnie 280 znaków.",
  root: "Wybrane miejsce leży poza granicami Polski.",
};

// Resolver backed by the shared schema: assemble the payload, validate it,
// translate Zod issues into Polish messages per field (lat/lng → a top-level banner).
function makeResolver(location: { lat: number; lng: number }): Resolver<ReportFormValues> {
  return (values) => {
    const parsed = sightingInputSchema.safeParse(toSightingInput(values, location));
    if (parsed.success) return { values, errors: {} };
    const errors: Record<string, { type: string; message: string }> = {};
    for (const issue of parsed.error.issues) {
      const field = String(issue.path[0] ?? "root");
      const key = field === "lat" || field === "lng" ? "root" : field;
      if (!errors[key]) {
        errors[key] = { type: "validate", message: FIELD_MESSAGES_PL[key] ?? "Nieprawidłowa wartość." };
      }
    }
    return { values: {}, errors: errors as never };
  };
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const LABEL_CLASS = "mb-1 text-xs font-semibold uppercase tracking-wider text-content";
const ERROR_CLASS = "mt-1 text-[11px] text-danger";
const BADGE_CLASS =
  "shrink-0 rounded-full bg-fill/10 px-2 py-0.5 text-[10px] font-medium text-content-soft";

// Nothing is preselected: any default would be a species the user did not choose,
// and GBIF's most-recorded is Amanita muscaria — photographed, not picked.

export function ReportForm({
  catalog,
  catalogStatus,
  onRetryCatalog,
  location,
  onClose,
  onReported,
}: ReportFormProps) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // The species popover portals in here, not into body: the dialog's scroll lock
  // cancels wheel and touch scrolling outside its own subtree.
  const dialogRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ReportFormValues>({
    resolver: makeResolver(location),
    // 0 fails the schema, so submitting without picking gives the "Wybierz gatunek
    // grzyba." field error instead of posting whatever happened to be first.
    defaultValues: { speciesKey: 0, foundAt: todayIso(), comment: "" },
  });

  const commentLength = watch("comment")?.length ?? 0;
  const rootError = (errors as { root?: { message?: string } }).root?.message;

  // Sorted once per catalogue, not on every keystroke.
  const sortedCatalog = useMemo(() => sortSpeciesByName(catalog), [catalog]);

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/sightings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSightingInput(values, location)),
      });
      if (res.status === 201) {
        // Refetch through MapView's single data path; no SSR to revalidate.
        onReported();
        onClose();
        return;
      }
      if (res.status === 429) {
        setServerError("Zbyt wiele zgłoszeń z tego adresu. Spróbuj ponownie za godzinę.");
        return;
      }
      if (res.status === 400) {
        setServerError("Nie udało się zapisać zgłoszenia — sprawdź wprowadzone dane.");
        return;
      }
      setServerError("Coś poszło nie tak. Spróbuj ponownie.");
    } catch {
      setServerError("Brak połączenia z serwerem. Sprawdź internet i spróbuj ponownie.");
    }
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent ref={dialogRef} className="max-w-sm rounded-2xl border-line/30 bg-surface/95 shadow-panel backdrop-blur-lg sm:max-w-sm">
        <DialogHeader className="text-left">
          <DialogTitle className="font-serif text-lg font-normal text-content">
            Zgłoś znalezisko
          </DialogTitle>
          <DialogDescription className="text-xs text-content-muted">
            Podziel się obserwacją ze społecznością
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-3">
          <div>
            <Label htmlFor="speciesKey" className={LABEL_CLASS}>
              Gatunek
            </Label>
            {/* Searchable, not a dropdown: a flat list of ~250 is unusable. */}
            <Controller
              control={control}
              name="speciesKey"
              render={({ field }) => {
                const selected = catalog.find((ref) => ref.taxonKey === field.value);
                const matches = sortedCatalog.filter((ref) => matchesSpeciesQuery(ref, query));
                return (
                  <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="speciesKey"
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={pickerOpen}
                        // An empty picker reads as a broken feature. Until the
                        // catalogue is in, the trigger says why instead.
                        disabled={catalogStatus !== "ready"}
                        className={`w-full justify-between font-normal ${
                          selected ? "" : "text-content-muted"
                        }`}
                      >
                        {selected ? speciesLabel(selected) : speciesTriggerLabel(catalogStatus)}
                        <ChevronDown
                          aria-hidden
                          className={`size-4 shrink-0 opacity-60 transition-transform ${
                            pickerOpen ? "rotate-180" : ""
                          }`}
                        />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      container={dialogRef.current}
                      className="w-(--radix-popover-trigger-width) p-0"
                    >
                      <Command
                        // Our own filter: shadcn's default scores the rendered
                        // text, which would miss a diacritic-free query.
                        shouldFilter={false}
                      >
                        <CommandInput
                          placeholder="Szukaj gatunku…"
                          value={query}
                          onValueChange={setQuery}
                        />
                        {/* Taller than the vendored max-h-72, which fitted six of
                            these two-line rows and read as a truncated list. */}
                        <CommandList className="scrollbar-slim max-h-[50vh]">
                          {/* Rendered by hand — with shouldFilter off, cmdk's own
                              match count never triggers it. */}
                          {matches.length === 0 && (
                            <CommandEmpty>Nie znaleziono gatunku.</CommandEmpty>
                          )}
                          {matches.map((ref) => (
                            <CommandItem
                              key={ref.taxonKey}
                              value={String(ref.taxonKey)}
                              data-checked={ref.taxonKey === field.value ? "true" : "false"}
                              className="cursor-pointer"
                              onSelect={() => {
                                field.onChange(ref.taxonKey);
                                setPickerOpen(false);
                              }}
                            >
                              <span className="flex-1">
                                <span className="block text-xs font-medium leading-tight text-content">
                                  {speciesLabel(ref)}
                                </span>
                                <span className="block text-latin">{ref.scientificName}</span>
                              </span>
                              {ref.isProtected && <span className={BADGE_CLASS}>pod ochroną</span>}
                            </CommandItem>
                          ))}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                );
              }}
            />
            {catalogStatus === "failed" && (
              <p className={ERROR_CLASS}>
                Serwer mógł się usypiać i budzi się nawet minutę.{" "}
                <button
                  type="button"
                  onClick={onRetryCatalog}
                  className="underline underline-offset-2"
                >
                  Spróbuj ponownie
                </button>
              </p>
            )}
            {errors.speciesKey && <p className={ERROR_CLASS}>{errors.speciesKey.message}</p>}
          </div>

          <div>
            <Label htmlFor="foundAt" className={LABEL_CLASS}>
              Data znalezienia
            </Label>
            <Input
              id="foundAt"
              type="date"
              aria-invalid={errors.foundAt ? true : undefined}
              {...register("foundAt")}
            />
            {errors.foundAt && <p className={ERROR_CLASS}>{errors.foundAt.message}</p>}
          </div>

          <div>
            <div className="flex items-center justify-between">
              <Label htmlFor="comment" className={LABEL_CLASS}>
                Komentarz (opcjonalnie)
              </Label>
              <span className="text-[10px] text-content-muted">{commentLength}/280</span>
            </div>
            <Textarea
              id="comment"
              rows={2}
              maxLength={280}
              placeholder="Np. skraj lasu iglastego, dużo młodych…"
              className="resize-none"
              aria-invalid={errors.comment ? true : undefined}
              {...register("comment")}
            />
            {errors.comment && <p className={ERROR_CLASS}>{errors.comment.message}</p>}
          </div>

          <p className="text-[10px] font-light leading-relaxed text-content-muted">
            Lokalizacja zostanie zaokrąglona do ok. 500 m — widać las, nie dokładny mech.
          </p>

          <p className="text-[10px] font-light leading-relaxed text-content-muted">
            Oznaczasz i zbierasz na własną odpowiedzialność. Aplikacja nie ocenia jadalności
            grzybów — zawsze weryfikuj z atlasem lub grzyboznawcą.
          </p>

          {(rootError || serverError) && (
            <p className={ERROR_CLASS} role="alert">
              {rootError ?? serverError}
            </p>
          )}

          <div className="mt-4 flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Anuluj
            </Button>
            <Button type="submit" className="flex-1" disabled={isSubmitting}>
              {isSubmitting ? "Wysyłanie…" : "Dodaj zgłoszenie"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
