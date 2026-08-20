import { describe, expect, it } from "vitest";
import { normalizePlanningDeck, planningDeckPresets } from "../composables/useDeckPreferences";

describe("planning deck preferences", () => {
  it("includes 21 in the default modified Fibonacci deck", () => {
    expect(planningDeckPresets[0].values).toContain("21");
  });

  it("normalizes, deduplicates and preserves custom values", () => {
    expect(normalizePlanningDeck([" 1 ", "3", "21", "21", "XL", ""])).toEqual(["1", "3", "21", "XL"]);
  });
});
