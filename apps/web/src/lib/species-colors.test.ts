import { describe, expect, it } from "vitest";
import { SPECIES_COLOR_PALETTE } from "@runo-map/shared";
import { COLOR } from "./tokens";
import { SPECIES_PIN_RAMP, pinAppearance, speciesColorMap } from "./species-colors";

describe("speciesColorMap", () => {
  it("turns the API stats into a species lookup", () => {
    const map = speciesColorMap([
      { species: "BOROWIK", count: 4, color: SPECIES_COLOR_PALETTE[0] },
      { species: "KURKA", count: 2, color: SPECIES_COLOR_PALETTE[1] },
    ]);

    expect(map.BOROWIK).toBe(SPECIES_COLOR_PALETTE[0]);
    expect(map.KURKA).toBe(SPECIES_COLOR_PALETTE[1]);
  });

  it("skips species that got no color, so a miss means no color", () => {
    const map = speciesColorMap([
      { species: "BOROWIK", count: 4, color: SPECIES_COLOR_PALETTE[0] },
      { species: "KANIA", count: 1 },
    ]);

    expect(map.KANIA).toBeUndefined();
    expect(Object.keys(map)).toEqual(["BOROWIK"]);
  });

  it("returns an empty lookup for no stats", () => {
    expect(speciesColorMap([])).toEqual({});
  });
});

describe("SPECIES_PIN_RAMP", () => {
  it("covers every palette color", () => {
    for (const color of SPECIES_COLOR_PALETTE) {
      expect(SPECIES_PIN_RAMP[color]).toBeDefined();
    }
  });

  it("starts each ramp at the palette color itself", () => {
    for (const color of SPECIES_COLOR_PALETTE) {
      expect(SPECIES_PIN_RAMP[color].fresh.background).toBe(color);
    }
  });

  it("gets lighter with age, so older pins read as paler", () => {
    const brightness = (hex: string) =>
      [1, 3, 5].reduce((sum, i) => sum + parseInt(hex.slice(i, i + 2), 16), 0);

    for (const color of SPECIES_COLOR_PALETTE) {
      const { fresh, recent, older } = SPECIES_PIN_RAMP[color];
      expect(brightness(recent.background)).toBeGreaterThan(brightness(fresh.background));
      expect(brightness(older.background)).toBeGreaterThan(brightness(recent.background));
    }
  });
});

describe("pinAppearance in age mode", () => {
  it("keeps the forest palette", () => {
    const fresh = pinAppearance("fresh", SPECIES_COLOR_PALETTE[0], "age");

    expect(fresh.background).toBe(COLOR.forestMid);
    expect(fresh.iconColor).toBe(COLOR.cream);
    expect(fresh.size).toBe(30);
  });

  it("shades older pins with stone regardless of species color", () => {
    const older = pinAppearance("older", SPECIES_COLOR_PALETTE[0], "age");

    expect(older.background).toBe(COLOR.stone);
    expect(older.iconColor).toBe(COLOR.forestSage);
    expect(older.size).toBe(20);
  });
});

describe("pinAppearance in species mode", () => {
  it("uses the species color at full strength for fresh pins", () => {
    const fresh = pinAppearance("fresh", SPECIES_COLOR_PALETTE[0], "species");

    expect(fresh.background).toBe(SPECIES_COLOR_PALETTE[0]);
    expect(fresh.iconColor).toBe(COLOR.cream);
    expect(fresh.size).toBe(30);
  });

  it("lightens the species color as the sighting ages", () => {
    const ramp = SPECIES_PIN_RAMP[SPECIES_COLOR_PALETTE[0]];

    expect(pinAppearance("recent", SPECIES_COLOR_PALETTE[0], "species").background).toBe(
      ramp.recent.background,
    );
    expect(pinAppearance("older", SPECIES_COLOR_PALETTE[0], "species").background).toBe(
      ramp.older.background,
    );
  });

  it("falls back to a neutral pin for a species outside the color budget", () => {
    const neutral = pinAppearance("fresh", undefined, "species");

    expect(neutral.background).toBe(COLOR.stone);
    expect(neutral.iconColor).toBe(COLOR.forestSage);
    expect(neutral.size).toBe(30);
  });

  it("keeps an unknown color usable instead of dropping the pin", () => {
    const unknown = pinAppearance("older", "#123456", "species");

    expect(unknown.background).toBe("#123456");
    expect(unknown.size).toBe(20);
  });

  it("preserves the three freshness sizes", () => {
    const sizes = (["fresh", "recent", "older"] as const).map(
      (age) => pinAppearance(age, SPECIES_COLOR_PALETTE[0], "species").size,
    );

    expect(sizes).toEqual([30, 24, 20]);
  });
});
