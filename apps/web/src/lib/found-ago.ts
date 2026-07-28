const DAY_MS = 24 * 60 * 60 * 1000;

// How long ago a report was found, in Polish. Anything under a day — including a
// foundAt slightly in the future from clock skew — reads as "dzisiaj".
export function formatFoundAgo(foundAt: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(foundAt).getTime()) / DAY_MS);
  if (days <= 0) return "dzisiaj";
  if (days === 1) return "wczoraj";
  return `${days} dni temu`;
}
