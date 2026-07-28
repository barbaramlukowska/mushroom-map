import { reportAgeCategory, type ReportAge } from "./report-age";
import { CELL_OUTLINE, COLOR } from "./tokens";

export interface CellAppearance {
  diameter: number;
  fill: string;
  ink: string;
  outline: string;
  label: string;
  fontSize: number;
}

// Size reinforces the number, it does not replace it: at low zoom the pattern of
// density reads without reading digits, and up close the exact value is right
// there. The smallest step is set by what one digit needs to stay legible.
const DIAMETER_STEPS: readonly { min: number; diameter: number }[] = [
  { min: 11, diameter: 46 },
  { min: 4, diameter: 34 },
  { min: 1, diameter: 24 },
];

// Fill carries ONE thing: how long ago the newest report in the cell was found.
// The ink flips on the palest fill because cream falls under 4.5:1 there —
// tokens.test.ts guards both directions.
const FILL_BY_AGE: Record<ReportAge, { fill: string; ink: string }> = {
  fresh: { fill: COLOR.cellFresh, ink: COLOR.cream },
  recent: { fill: COLOR.cellRecent, ink: COLOR.cream },
  older: { fill: COLOR.cellStale, ink: COLOR.cellInkDark },
};

// Three digits do not fit without dropping the font below legibility. The cap is
// in the label only — the count itself is never truncated.
const LABEL_CAP = 99;

// Above this zoom every circle shows its number. The digit crowding that the
// blanking below answers was measured at the whole-of-Poland zooms, where
// single-report circles sit close enough that a lone digit can overlap its
// neighbour. From zoom 8 in they are far enough apart, and the legend in
// top-bar.tsx ("Liczba w kółku…") is then true of every circle on screen.
const CROWDED_ZOOM_MAX = 7;

export function cellAppearance(
  count: number,
  newestFoundAt: string,
  now: Date,
  zoom: number,
): CellAppearance {
  const step = DIAMETER_STEPS.find(({ min }) => count >= min) ?? DIAMETER_STEPS[2];
  const { fill, ink } = FILL_BY_AGE[reportAgeCategory(newestFoundAt, now)];

  // A count of one at the smallest diameter carries no information a bare dot
  // doesn't already show, so at the crowded zooms the label is dropped rather
  // than risk that clash. Everywhere else the number is always printed.
  const isCrowdedLoneReport = count === 1 && step.diameter === 24 && zoom <= CROWDED_ZOOM_MAX;
  const label = isCrowdedLoneReport ? "" : String(count > LABEL_CAP ? `${LABEL_CAP}+` : count);

  return {
    diameter: step.diameter,
    fill,
    ink,
    // Never varies — see the comment on --cell-line in globals.css.
    outline: CELL_OUTLINE,
    label,
    fontSize: Math.round(step.diameter * 0.42),
  };
}
