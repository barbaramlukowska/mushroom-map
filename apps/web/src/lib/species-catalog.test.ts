import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpeciesRef } from "@runo-map/shared";
import {
  buildSpeciesLookup,
  fetchSpeciesCatalog,
  speciesTriggerLabel,
  matchesSpeciesQuery,
  sortSpeciesByName,
  speciesLabel,
} from "./species-catalog";

const borowik: SpeciesRef = {
  taxonKey: 10,
  scientificName: "Boletus edulis",
  namePl: "Borowik szlachetny",
  occurrenceCount: 900,
  isProtected: false,
};
const nameless: SpeciesRef = {
  taxonKey: 20,
  scientificName: "Cortinarius sp",
  namePl: null,
  occurrenceCount: null,
  isProtected: false,
};

describe("buildSpeciesLookup", () => {
  it("maps key to record", () => {
    expect(buildSpeciesLookup([borowik, nameless]).get(20)?.scientificName).toBe("Cortinarius sp");
  });

  it("is empty for an empty catalogue", () => {
    expect(buildSpeciesLookup([]).size).toBe(0);
  });
});

describe("speciesLabel", () => {
  it("prefers the Polish name", () => {
    expect(speciesLabel(borowik)).toBe("Borowik szlachetny");
  });

  it("falls back to the scientific name when there is no Polish one", () => {
    expect(speciesLabel(nameless)).toBe("Cortinarius sp");
  });

  it("names the gap when the key is not in the catalogue", () => {
    expect(speciesLabel(undefined)).toBe("Nieznany gatunek");
  });
});

describe("sortSpeciesByName", () => {
  const ref = (namePl: string | null, scientificName = "Zzz sp"): SpeciesRef => ({
    taxonKey: namePl?.length ?? 1,
    scientificName,
    namePl,
    occurrenceCount: null,
    isProtected: false,
  });

  it("orders by the displayed name, not by popularity", () => {
    const sorted = sortSpeciesByName([
      { ...borowik, namePl: "Zasłonak" },
      { ...borowik, taxonKey: 11, namePl: "Borowik szlachetny" },
    ]);
    expect(sorted.map((s) => s.namePl)).toEqual(["Borowik szlachetny", "Zasłonak"]);
  });

  it("collates Polish letters where a Pole expects them", () => {
    const sorted = sortSpeciesByName([ref("Żółciak"), ref("Zasłonak"), ref("Łuskwiak"), ref("Lakownica")]);
    expect(sorted.map((s) => s.namePl)).toEqual(["Lakownica", "Łuskwiak", "Zasłonak", "Żółciak"]);
  });

  it("sorts a name-less species by the scientific name it falls back to", () => {
    const sorted = sortSpeciesByName([ref(null, "Zzz sp"), ref(null, "Aaa sp")]);
    expect(sorted.map((s) => s.scientificName)).toEqual(["Aaa sp", "Zzz sp"]);
  });

  it("does not mutate the caller's array", () => {
    const input = [ref("Zasłonak"), ref("Borowik")];
    sortSpeciesByName(input);
    expect(input[0].namePl).toBe("Zasłonak");
  });
});

describe("matchesSpeciesQuery", () => {
  it("matches the Polish name, the scientific name and an empty query", () => {
    expect(matchesSpeciesQuery(borowik, "borow")).toBe(true);
    expect(matchesSpeciesQuery(borowik, "edulis")).toBe(true);
    expect(matchesSpeciesQuery(borowik, "")).toBe(true);
  });

  it("ignores case and diacritics", () => {
    const zolciak: SpeciesRef = { ...borowik, namePl: "Żółciak siarkowy" };
    expect(matchesSpeciesQuery(zolciak, "zolciak")).toBe(true);
    expect(matchesSpeciesQuery(zolciak, "ZÓŁ")).toBe(true);
  });

  // ł is the one Polish letter NFD leaves alone, so it needs its own rule —
  // without it "maslak" would not find "Maślak".
  it("folds the stroked l in both directions", () => {
    const maslak: SpeciesRef = { ...borowik, namePl: "Maślak zwyczajny" };
    expect(matchesSpeciesQuery(maslak, "maslak")).toBe(true);
    expect(matchesSpeciesQuery(maslak, "maślak")).toBe(true);
  });

  it("treats a whitespace-only query as no query", () => {
    expect(matchesSpeciesQuery(borowik, "   ")).toBe(true);
  });

  it("still matches the scientific name of a species with no Polish one", () => {
    expect(matchesSpeciesQuery(nameless, "cortin")).toBe(true);
  });

  it("rejects a non-match", () => {
    expect(matchesSpeciesQuery(borowik, "kurka")).toBe(false);
  });
});

describe("fetchSpeciesCatalog", () => {
  beforeEach(() => {
    // The retries sleep between attempts; no test should wait that out for real.
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // One queued outcome per call, so a test can describe a cold start: the first
  // attempts fail, a later one answers. The last outcome repeats.
  function stubFetch(outcomes: Array<() => Promise<Response>>) {
    const calls = { count: 0 };
    vi.stubGlobal("fetch", () => {
      const outcome = outcomes[Math.min(calls.count, outcomes.length - 1)];
      calls.count += 1;
      return outcome();
    });
    return calls;
  }

  const ok = (body: SpeciesRef[]) => () =>
    Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  // What Render answers while a spun-down instance is booting.
  const badGateway = () => Promise.resolve(new Response("", { status: 502 }));
  const connectionRefused = () => Promise.reject(new TypeError("fetch failed"));

  it("returns the catalogue when the API answers straight away", async () => {
    const calls = stubFetch([ok([borowik])]);
    const result = fetchSpeciesCatalog();
    await vi.runAllTimersAsync();
    expect(await result).toEqual([borowik]);
    expect(calls.count).toBe(1);
  });

  it("retries a cold-starting API and returns the catalogue once it wakes up", async () => {
    const calls = stubFetch([connectionRefused, badGateway, ok([borowik])]);
    const result = fetchSpeciesCatalog();
    await vi.runAllTimersAsync();
    expect(await result).toEqual([borowik]);
    expect(calls.count).toBe(3);
  });

  // MapView aborts on unmount. Retrying past that would keep the request alive
  // and hand a result to a component that is gone.
  it("stops on the first attempt when the caller aborts", async () => {
    const controller = new AbortController();
    const calls = stubFetch([
      () => {
        controller.abort();
        return Promise.reject(new DOMException("The operation was aborted.", "AbortError"));
      },
    ]);
    const result = fetchSpeciesCatalog(controller.signal).catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect((await result as Error).name).toBe("AbortError");
    expect(calls.count).toBe(1);
  });

  it("gives up and throws once every attempt has failed", async () => {
    const calls = stubFetch([badGateway]);
    const result = fetchSpeciesCatalog().catch((error: unknown) => error);
    await vi.runAllTimersAsync();
    expect(await result).toBeInstanceOf(Error);
    expect(calls.count).toBeGreaterThan(1);
  });
});

describe("speciesTriggerLabel", () => {
  // Nothing is preselected, so the trigger is the only place the picker can admit
  // that the list behind it is not there yet.
  it("invites a choice once the catalogue is in", () => {
    expect(speciesTriggerLabel("ready")).toBe("Wybierz gatunek…");
  });

  it("says the catalogue is still coming rather than promising a list", () => {
    expect(speciesTriggerLabel("loading")).toBe("Wczytywanie gatunków…");
  });

  it("names the failure instead of showing an empty picker", () => {
    expect(speciesTriggerLabel("failed")).toBe("Nie udało się wczytać gatunków");
  });
});
