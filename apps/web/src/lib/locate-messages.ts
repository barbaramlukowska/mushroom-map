// Maps Geolocation API error codes (surfaced by Leaflet's `locationerror`
// event) to Polish user-facing messages. Codes: 1 = PERMISSION_DENIED,
// 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT; anything else gets the generic text.
const GENERIC_MESSAGE = "Nie udało się ustalić lokalizacji — możesz dalej klikać w mapę.";

export function locateErrorMessage(code: number): string {
  if (code === 1) return "Brak zgody na lokalizację — możesz dalej klikać w mapę.";
  if (code === 3) return "Ustalanie lokalizacji trwało zbyt długo — spróbuj ponownie.";
  return GENERIC_MESSAGE;
}
