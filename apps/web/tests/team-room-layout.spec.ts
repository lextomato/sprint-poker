import { describe, expect, it } from "vitest";
import officeScene from "../game/officeScene.json";

type Fixture = {
  id: string;
  x: number;
  y: number;
  worldX?: number;
  worldY?: number;
  width: number;
  height: number;
};

const fixture = (id: string) => officeScene.fixtures.find((item) => item.id === id)! as Fixture;
const worldX = (item: Fixture) => item.worldX ?? item.x;
const worldY = (item: Fixture) => item.worldY ?? item.y;

describe("virtual team room furniture layout", () => {
  it("keeps the planning entrance open and separates the table from storage", () => {
    const table = fixture("planning-table");
    const storage = fixture("planning-storage");

    expect(worldX(table) - 820).toBeGreaterThanOrEqual(35);
    expect(worldX(table) + table.width).toBeLessThan(worldX(storage));
  });

  it("keeps plants inside their room floors instead of on the front walls", () => {
    const dailyPlant = fixture("daily-plant");
    const retroPlant = fixture("retro-plant");
    const coffeePlant = fixture("coffee-plant");

    expect(worldY(dailyPlant) + dailyPlant.height).toBeLessThanOrEqual(260);
    expect(worldY(retroPlant) + retroPlant.height).toBeLessThanOrEqual(628);
    expect(worldY(coffeePlant) + coffeePlant.height).toBeLessThanOrEqual(628);
  });
});
