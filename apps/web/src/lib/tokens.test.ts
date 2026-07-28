import { describe, expect, it } from "vitest";
import { COLOR } from "./tokens";

// Relative luminance + contrast ratio per WCAG 2.x.
function luminance(hex: string): number {
  const c = hex.replace("#", "");
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(c.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// Composite a foreground color over a background color at a given alpha
// (standard "over" alpha blend: out = alpha*fg + (1-alpha)*bg per channel),
// formatted back to a 6-digit hex string.
function over(fgHex: string, alpha: number, bgHex: string): string {
  const toChannels = (hex: string) => {
    const c = hex.replace("#", "");
    return [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16));
  };
  const fg = toChannels(fgHex);
  const bg = toChannels(bgHex);
  const blended = fg.map((fgChannel, i) => {
    const bgChannel = bg[i];
    const out = alpha * fgChannel + (1 - alpha) * bgChannel;
    return Math.round(out);
  });
  return (
    "#" +
    blended.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, "0")).join("")
  );
}

// WCAG 2.2 SC 1.4.3: normal-size text needs >= 4.5:1 on its background.
describe("token contrast (WCAG 2.2 AA text)", () => {
  const AA = 4.5;
  it.each([
    ["content on surface", COLOR.forestDeep, COLOR.cream],
    ["content-soft on surface", COLOR.forestMid, COLOR.cream],
    ["content-muted on surface", COLOR.forestMoss, COLOR.cream],
    ["action on surface", COLOR.amber, COLOR.cream],
    ["danger on surface", COLOR.red, COLOR.cream],
    ["inverse on fill", COLOR.cream, COLOR.forestMid],
    // shadcn bridge pairs (globals.css :root)
    ["muted-foreground on muted", COLOR.forestMid, COLOR.creamDim],
    ["secondary-foreground on secondary", COLOR.forestDeep, COLOR.creamDim],
    ["accent-foreground on accent", COLOR.forestDeep, COLOR.creamDim],
    ["destructive-foreground on destructive", COLOR.cream, COLOR.red],
  ])("%s meets AA", (_label, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA);
  });
});

// The number inside a circle is TEXT, so the bar is 4.5:1 (WCAG 2.2 SC 1.4.3) —
// higher than the 3:1 that applied to the old graphical mushroom glyph.
describe("cell number contrast (WCAG 2.2 AA text)", () => {
  const AA = 4.5;

  it.each([
    ["cream on fresh cell", COLOR.cream, COLOR.cellFresh],
    ["cream on recent cell", COLOR.cream, COLOR.cellRecent],
    ["dark ink on stale cell", COLOR.cellInkDark, COLOR.cellStale],
  ])("%s meets AA", (_label, ink, fill) => {
    expect(contrast(ink, fill)).toBeGreaterThanOrEqual(AA);
  });

  // Why the palest step flips to dark ink instead of keeping cream everywhere.
  it("cream on the stale cell fails AA (why the ink flips)", () => {
    expect(contrast(COLOR.cream, COLOR.cellStale)).toBeLessThan(AA);
  });
});

// Each step must be far enough from its neighbour in luminance to read as a
// different step at a glance, not just to pass a contrast check against text.
describe("cell fill ramp separation", () => {
  it("gets lighter at every step", () => {
    expect(luminance(COLOR.cellFresh)).toBeLessThan(luminance(COLOR.cellRecent));
    expect(luminance(COLOR.cellRecent)).toBeLessThan(luminance(COLOR.cellStale));
  });

  it("keeps every adjacent pair at 1.6:1 or better", () => {
    expect(contrast(COLOR.cellFresh, COLOR.cellRecent)).toBeGreaterThanOrEqual(1.6);
    expect(contrast(COLOR.cellRecent, COLOR.cellStale)).toBeGreaterThanOrEqual(1.6);
  });

  // The circles sit on the map surface, so the palest one still needs to be
  // visible against it — that is what the shared outline is for, but the fill
  // must not be effectively invisible either.
  it("keeps the palest fill distinguishable from the map surface", () => {
    expect(contrast(COLOR.cellStale, COLOR.creamDim)).toBeGreaterThanOrEqual(1.15);
  });
});

describe("reduced-opacity text contrast (WCAG 2.2 AA)", () => {
  const AA = 4.5;

  it("shipped subtitle color (content-muted on surface) meets AA", () => {
    expect(contrast(COLOR.forestMoss, COLOR.cream)).toBeGreaterThanOrEqual(AA);
  });

  // Regression guard: content-soft at 70% opacity fails AA over surface —
  // subtitles use full-opacity content-muted instead.
  it("content-soft at 70% opacity fails AA over surface (why it was removed)", () => {
    expect(contrast(over(COLOR.forestMid, 0.7, COLOR.cream), COLOR.cream)).toBeLessThan(AA);
  });
});
