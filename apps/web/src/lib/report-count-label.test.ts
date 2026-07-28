import { describe, expect, it } from "vitest";
import { reportCountLabel } from "./report-count-label";

describe("reportCountLabel", () => {
  it.each([
    [0, "0 zgłoszeń"],
    [1, "1 zgłoszenie"],
    [2, "2 zgłoszenia"],
    [4, "4 zgłoszenia"],
    [5, "5 zgłoszeń"],
    [11, "11 zgłoszeń"],
    [12, "12 zgłoszeń"],
    [13, "13 zgłoszeń"],
    [14, "14 zgłoszeń"],
    [21, "21 zgłoszeń"],
    [22, "22 zgłoszenia"],
    [25, "25 zgłoszeń"],
    [102, "102 zgłoszenia"],
    [104, "104 zgłoszenia"],
    [111, "111 zgłoszeń"],
  ])("reportCountLabel(%i) === %s", (count, expected) => {
    expect(reportCountLabel(count)).toBe(expected);
  });
});
