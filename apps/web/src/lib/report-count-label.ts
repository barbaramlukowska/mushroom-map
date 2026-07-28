// Polish nouns decline by count into three plural forms (singular, "few", "many"),
// unlike English's singular/plural split — this is the only place in the codebase
// that declines a Polish noun, so the rule is spelled out here for the next reader.
export function reportCountLabel(count: number): string {
  if (count === 1) return `${count} zgłoszenie`;

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const isFewForm =
    (lastDigit === 2 || lastDigit === 3 || lastDigit === 4) &&
    !(lastTwoDigits === 12 || lastTwoDigits === 13 || lastTwoDigits === 14);

  return isFewForm ? `${count} zgłoszenia` : `${count} zgłoszeń`;
}
