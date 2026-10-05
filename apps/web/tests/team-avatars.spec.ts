import { describe, expect, it } from "vitest";
import { isDirectionalTeamAvatar, teamAvatarDirectionImage, teamAvatarFacingForVector, teamAvatarImage } from "../utils/teamAvatars";

describe("directional team avatars", () => {
  it("maps movement vectors to the eight static facings", () => {
    expect(teamAvatarFacingForVector(1, 0)).toBe("profile-right");
    expect(teamAvatarFacingForVector(1, 1)).toBe("front-quarter-right");
    expect(teamAvatarFacingForVector(0, 1)).toBe("front");
    expect(teamAvatarFacingForVector(-1, -1)).toBe("back-quarter-left");
    expect(teamAvatarFacingForVector(0, 0)).toBeNull();
  });

  it("uses the transparent directional artwork for the four new options", () => {
    expect(isDirectionalTeamAvatar("curly")).toBe(true);
    expect(teamAvatarImage("curly")).toBe("/game/team-room/avatars-directional/curly/01-front.png");
    expect(teamAvatarDirectionImage("cream", "back")).toBe("/game/team-room/avatars-directional/cream/05-back.png");
    expect(teamAvatarImage("sage")).toBe("/game/team-room/avatars-34/sage.png");
  });

  it("compensates for left/right labels reversed in the generated directional sprites", () => {
    expect(teamAvatarDirectionImage("cream", "profile-right")).toContain("07-profile-left.png");
    expect(teamAvatarDirectionImage("cream", "profile-left")).toContain("03-profile-right.png");
    expect(teamAvatarDirectionImage("cream", "front-quarter-right")).toContain("08-front-quarter-left.png");
    expect(teamAvatarDirectionImage("cream", "back-quarter-left")).toContain("04-back-quarter-right.png");
    expect(teamAvatarDirectionImage("cream", "front")).toContain("01-front.png");
  });
});
