export type PinAge = "fresh" | "recent" | "older";

const DAY_MS = 24 * 60 * 60 * 1000;

// Thresholds match the map legend and the filter presets: fresh < 3 days,
// recent 3–7, older beyond a week. Two weeks is the outer limit of a mushroom
// still being worth a trip, so the old 7/14 split spent both steps on stale data.
export function pinAgeCategory(foundAt: string, now: Date): PinAge {
  const ageDays = (now.getTime() - new Date(foundAt).getTime()) / DAY_MS;
  if (ageDays < 3) return "fresh";
  if (ageDays < 7) return "recent";
  return "older";
}
