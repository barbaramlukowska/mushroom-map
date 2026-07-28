import { describe, expect, it } from "vitest";
import { cellAppearance } from "./cell-appearance";
import { CELL_OUTLINE, COLOR } from "./tokens";

const NOW = new Date("2026-07-28T12:00:00.000Z");
const daysAgo = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe("cellAppearance — diameter from the count", () => {
  it.each([
    [1, 24],
    [3, 24],
    [4, 34],
    [10, 34],
    [11, 46],
    [250, 46],
  ])("gives a count of %i a diameter of %i px", (count, diameter) => {
    expect(cellAppearance(count, daysAgo(1), NOW, 10).diameter).toBe(diameter);
  });

  it("never shrinks below the size a single digit needs", () => {
    expect(cellAppearance(1, daysAgo(1), NOW, 10).diameter).toBeGreaterThanOrEqual(24);
  });
});

describe("cellAppearance — fill from the newest report", () => {
  it("fills a cell reported today with the freshest step", () => {
    expect(cellAppearance(5, daysAgo(0), NOW, 10).fill).toBe(COLOR.cellFresh);
  });

  it("fills a cell last reported 5 days ago with the middle step", () => {
    expect(cellAppearance(5, daysAgo(5), NOW, 10).fill).toBe(COLOR.cellRecent);
  });

  it("fills a cell last reported 3 weeks ago with the palest step", () => {
    expect(cellAppearance(5, daysAgo(21), NOW, 10).fill).toBe(COLOR.cellStale);
  });

  // Freshness is independent of how many reports there are: a single fresh
  // report is dark, a hundred stale ones are pale.
  it("keeps fill independent of count", () => {
    expect(cellAppearance(1, daysAgo(1), NOW, 10).fill).toBe(
      cellAppearance(500, daysAgo(1), NOW, 10).fill,
    );
  });
});

describe("cellAppearance — ink flips on the palest fill", () => {
  it("uses cream on the two darker fills", () => {
    expect(cellAppearance(5, daysAgo(1), NOW, 10).ink).toBe(COLOR.cream);
    expect(cellAppearance(5, daysAgo(5), NOW, 10).ink).toBe(COLOR.cream);
  });

  it("uses dark ink on the palest fill", () => {
    expect(cellAppearance(5, daysAgo(21), NOW, 10).ink).toBe(COLOR.cellInkDark);
  });
});

describe("cellAppearance — one outline for every circle", () => {
  it("returns the same outline regardless of count and age", () => {
    const outlines = [
      cellAppearance(1, daysAgo(1), NOW, 10).outline,
      cellAppearance(50, daysAgo(21), NOW, 10).outline,
      cellAppearance(7, daysAgo(5), NOW, 10).outline,
    ];

    expect(new Set(outlines).size).toBe(1);
    expect(outlines[0]).toBe(CELL_OUTLINE);
  });
});

describe("cellAppearance — label", () => {
  it("prints the count as-is up to 99", () => {
    expect(cellAppearance(7, daysAgo(1), NOW, 10).label).toBe("7");
    expect(cellAppearance(99, daysAgo(1), NOW, 10).label).toBe("99");
  });

  // Three digits do not fit a 46 px circle without dropping the font below
  // legibility, so the count is capped in the label only — never in the data.
  it("caps at 99+ above 99", () => {
    expect(cellAppearance(100, daysAgo(1), NOW, 10).label).toBe("99+");
    expect(cellAppearance(4213, daysAgo(1), NOW, 10).label).toBe("99+");
  });

  // At the low zooms (whole-of-Poland) circles pack tightly enough that a lone
  // digit can overlap its neighbour. Blanking is scoped to those zooms only —
  // from zoom 8 in, every circle shows its number, which is what the legend in
  // top-bar.tsx promises.
  it("hides the label for a lone report at the low zooms", () => {
    expect(cellAppearance(1, daysAgo(1), NOW, 6).label).toBe("");
    expect(cellAppearance(1, daysAgo(1), NOW, 7).label).toBe("");
  });

  it("shows the label for a lone report from zoom 8 in", () => {
    expect(cellAppearance(1, daysAgo(1), NOW, 8).label).toBe("1");
    expect(cellAppearance(1, daysAgo(1), NOW, 14).label).toBe("1");
  });

  it("never blanks a count above one, even at the lowest zoom", () => {
    expect(cellAppearance(2, daysAgo(1), NOW, 6).label).toBe("2");
  });

  it("still shows the count once the circle grows past the smallest diameter", () => {
    expect(cellAppearance(4, daysAgo(1), NOW, 6).label).toBe("4");
  });

  it("scales the font with the circle", () => {
    const small = cellAppearance(1, daysAgo(1), NOW, 10);
    const large = cellAppearance(20, daysAgo(1), NOW, 10);

    expect(large.fontSize).toBeGreaterThan(small.fontSize);
    expect(small.fontSize).toBeGreaterThanOrEqual(10);
  });
});
