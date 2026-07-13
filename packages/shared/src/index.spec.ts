import { calculateVoteStatistics } from "./index";
import { describe, expect, it } from "vitest";

describe("calculateVoteStatistics", () => {
  it("excludes question and break cards from numeric statistics", () => {
    const stats = calculateVoteStatistics(["3", "5", "5", "?", "BREAK"]);
    expect(stats.count).toBe(3);
    expect(stats.average).toBe(4.33);
    expect(stats.median).toBe(5);
    expect(stats.mode).toBe(5);
    expect(stats.consensus).toBe(66.7);
    expect(stats.hasQuestion).toBe(true);
    expect(stats.hasBreak).toBe(true);
  });
});
