import type { SpeciesStat } from "@runo-map/shared";
import type { PinAge } from "./pin-age";
import { COLOR } from "./tokens";

export type PinMode = "age" | "species";

export interface PinAppearance {
  background: string;
  iconColor: string;
  size: number;
}

// Species beyond the color budget arrive without a color and are left out of the
// lookup, so a miss means "no color" rather than "not reported yet".
export function speciesColorMap(stats: SpeciesStat[]): Record<string, string> {
  return Object.fromEntries(
    stats.flatMap((stat) => (stat.color ? [[stat.species, stat.color]] : [])),
  );
}

const PIN_SIZE: Record<PinAge, number> = { fresh: 30, recent: 24, older: 20 };

interface PinFill {
  background: string;
  iconColor: string;
}

// "Dark pins are fresh, pale ones are older" (the wording in about-modal) applied
// to species colors: each step raises OKLCH lightness by 0.08 while preserving
// chroma. Mixing toward stone instead would fade the species apart — at 45% the
// closest pair drops from dE 16 to 9, under the palette validator's normal-vision
// floor, so two species stop being distinguishable. Glyph flips to the dark token
// where cream falls under 3:1; tokens.test.ts guards every pair here.
export const SPECIES_PIN_RAMP: Record<string, Record<PinAge, PinFill>> = {
  "#2a78d6": {
    fresh: { background: "#2a78d6", iconColor: COLOR.cream },
    recent: { background: "#4491f1", iconColor: COLOR.cream },
    older: { background: "#6cacfe", iconColor: COLOR.forestDeep },
  },
  "#c2410c": {
    fresh: { background: "#c2410c", iconColor: COLOR.cream },
    recent: { background: "#de5b2f", iconColor: COLOR.cream },
    older: { background: "#fa7549", iconColor: COLOR.forestDeep },
  },
  "#0f8a57": {
    fresh: { background: "#0f8a57", iconColor: COLOR.cream },
    recent: { background: "#36a36e", iconColor: COLOR.cream },
    older: { background: "#53bc86", iconColor: COLOR.forestDeep },
  },
  "#4a3aa7": {
    fresh: { background: "#4a3aa7", iconColor: COLOR.cream },
    recent: { background: "#5e53c2", iconColor: COLOR.cream },
    older: { background: "#746bdd", iconColor: COLOR.cream },
  },
};

const AGE_MODE_FILL: Record<PinAge, PinFill> = {
  fresh: { background: COLOR.forestMid, iconColor: COLOR.cream },
  recent: { background: COLOR.forestSoft, iconColor: COLOR.cream },
  older: { background: COLOR.stone, iconColor: COLOR.forestSage },
};

export function pinAppearance(
  age: PinAge,
  speciesColor: string | undefined,
  mode: PinMode,
): PinAppearance {
  const size = PIN_SIZE[age];

  if (mode === "age") return { ...AGE_MODE_FILL[age], size };

  // Outside the color budget: the neutral pin, with size left to carry freshness.
  if (!speciesColor) return { ...AGE_MODE_FILL.older, size };

  const ramp = SPECIES_PIN_RAMP[speciesColor];
  if (!ramp) return { background: speciesColor, iconColor: COLOR.cream, size };
  return { ...ramp[age], size };
}
