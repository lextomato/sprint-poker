import { describe, expect, it } from "vitest";
import { canMoveInTeamRoom } from "../utils/teamRoomKeyboard";

describe("virtual room keyboard focus", () => {
  it("only enables movement while the room canvas owns focus", () => {
    const canvas = document.createElement("canvas");
    const input = document.createElement("input");

    expect(canMoveInTeamRoom(canvas, canvas, true)).toBe(true);
    expect(canMoveInTeamRoom(input, canvas, true)).toBe(false);
    expect(canMoveInTeamRoom(null, canvas, true)).toBe(false);
    expect(canMoveInTeamRoom(canvas, canvas, false)).toBe(false);
  });

  it("rejects editable and textbox targets", () => {
    const canvas = document.createElement("canvas");
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    const textbox = document.createElement("div");
    textbox.setAttribute("role", "textbox");

    expect(canMoveInTeamRoom(editor, canvas, true)).toBe(false);
    expect(canMoveInTeamRoom(textbox, canvas, true)).toBe(false);
  });
});
