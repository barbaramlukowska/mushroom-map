import { describe, expect, it } from "vitest";
import { locateErrorMessage } from "./locate-messages";

describe("locateErrorMessage", () => {
  it("maps PERMISSION_DENIED (1) to a permission hint", () => {
    expect(locateErrorMessage(1)).toBe(
      "Brak zgody na lokalizację — możesz dalej klikać w mapę.",
    );
  });

  it("maps POSITION_UNAVAILABLE (2) to an unavailability message", () => {
    expect(locateErrorMessage(2)).toBe(
      "Nie udało się ustalić lokalizacji — możesz dalej klikać w mapę.",
    );
  });

  it("maps TIMEOUT (3) to a timeout message", () => {
    expect(locateErrorMessage(3)).toBe(
      "Ustalanie lokalizacji trwało zbyt długo — spróbuj ponownie.",
    );
  });

  it("falls back to the generic message for unknown codes", () => {
    expect(locateErrorMessage(0)).toBe(
      "Nie udało się ustalić lokalizacji — możesz dalej klikać w mapę.",
    );
    expect(locateErrorMessage(99)).toBe(
      "Nie udało się ustalić lokalizacji — możesz dalej klikać w mapę.",
    );
  });
});
