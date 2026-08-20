import { DailyMode, TeamAvailability, TeamZone, authRegisterSchema, calculateVoteStatistics, dailyEntrySchema, dailySessionCreateSchema, retroCommentCreateSchema, retroReactionToggleSchema, teamNoteCreateSchema, teamPositionSchema, teamPresenceSchema } from "./index";
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

describe("accounts and daily schemas", () => {
  it("normalizes account email and accepts a persistent user", () => {
    const result = authRegisterSchema.parse({ email: " Ada@Example.COM ", password: "correct-horse", displayName: "Ada" });
    expect(result.email).toBe("ada@example.com");
  });

  it("accepts a team update with a blocker", () => {
    const dailyId = "21a4ad07-52b0-4f8a-b5e1-88f820ff4333";
    expect(dailyEntrySchema.parse({ dailyId, yesterday: "", today: "", blocker: "Falta acceso" }).blocker).toBe("Falta acceso");
    expect(dailySessionCreateSchema.parse({ date: "2026-08-19", mode: DailyMode.HYBRID, turnDurationSeconds: 120 }).mode).toBe(DailyMode.HYBRID);
  });

  it("rejects empty daily updates", () => {
    expect(() => dailyEntrySchema.parse({ dailyId: "21a4ad07-52b0-4f8a-b5e1-88f820ff4333", yesterday: "", today: "" })).toThrow();
  });
});

describe("team room movement", () => {
  it("accepts a selectable team avatar", () => {
    expect(teamPresenceSchema.parse({ availability: TeamAvailability.AVAILABLE, zone: TeamZone.TEAM_ROOM, avatarId: "coral" }).avatarId).toBe("coral");
    expect(() => teamPresenceSchema.parse({ availability: TeamAvailability.AVAILABLE, zone: TeamZone.TEAM_ROOM, avatarId: "unknown" })).toThrow();
  });

  it("accepts normalized positions inside the map", () => {
    expect(teamPositionSchema.parse({ x: 0.42, y: 0.73, zone: TeamZone.COFFEE_AREA }).zone).toBe(TeamZone.COFFEE_AREA);
  });

  it("rejects coordinates outside the playable area", () => {
    expect(() => teamPositionSchema.parse({ x: 1.2, y: 0.5, zone: TeamZone.TEAM_ROOM })).toThrow();
  });

  it("validates temporary coffee notes", () => {
    expect(teamNoteCreateSchema.parse({ content: "Demo del viernes" }).content).toBe("Demo del viernes");
    expect(() => teamNoteCreateSchema.parse({ content: " " })).toThrow();
  });
});

describe("retrospective discussion schemas", () => {
  it("accepts valid comments and reactions", () => {
    const cardId = "21a4ad07-52b0-4f8a-b5e1-88f820ff4333";
    expect(retroCommentCreateSchema.parse({ cardId, content: "Buen punto" }).content).toBe("Buen punto");
    expect(retroReactionToggleSchema.parse({ cardId, emoji: "👍" }).emoji).toBe("👍");
  });

  it("rejects empty comments", () => {
    expect(() => retroCommentCreateSchema.parse({ cardId: "21a4ad07-52b0-4f8a-b5e1-88f820ff4333", content: " " })).toThrow();
  });
});
