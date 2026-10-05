import fs from "node:fs/promises";
import ts from "typescript";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = await fs.readFile(new URL("../apps/web/game/teamRoomWorld.ts", import.meta.url), "utf8");
const syntax = ts.createSourceFile("teamRoomWorld.ts", source, ts.ScriptTarget.Latest, true);
const scene = JSON.parse(await fs.readFile(new URL("../apps/web/game/officeScene.json", import.meta.url), "utf8"));
function constant(name) {
  for (const statement of syntax.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    const declaration = statement.declarationList.declarations.find((node) => node.name.getText(syntax) === name);
    if (declaration) return vm.runInNewContext(`(${declaration.initializer.getText(syntax)})`, { TeamZone: new Proxy({}, { get: (_, key) => key }) });
  }
  throw new Error(`Missing ${name}`);
}
const width = constant("WORLD_WIDTH");
const height = constant("WORLD_HEIGHT");
const cell = constant("NAV_CELL_SIZE");
const columns = width / cell;
const rows = height / cell;
const grid = Array.from({ length: rows }, () => Array(columns).fill(false));
function obstacle(x, y, w, h) {
  for (let row = Math.max(0, Math.floor((y - h / 2 - 13) / cell)); row <= Math.min(rows - 1, Math.floor((y + h / 2 + 13) / cell)); row++) {
    for (let col = Math.max(0, Math.floor((x - w / 2 - 13) / cell)); col <= Math.min(columns - 1, Math.floor((x + w / 2 + 13) / cell)); col++) grid[row][col] = true;
  }
}
for (const f of scene.fixtures) {
  if (f.collider) obstacle(f.collider.x, f.collider.y, f.collider.width, f.collider.height);
}
for (const z of constant("ZONES")) {
  const side = z.door === "right" ? z.x + z.width : z.x;
  const closedSide = z.door === "right" ? z.x : z.x + z.width;
  const segment = z.height / 2 - 38;
  obstacle(closedSide, z.y + z.height / 2, 10, z.height);
  obstacle(side, z.y + segment / 2, 10, segment);
  obstacle(side, z.y + z.height - segment / 2, 10, segment);
  obstacle(z.x + z.width / 2, z.y, z.width, 10);
  obstacle(z.x + z.width / 2, z.y + z.height, z.width, 10);
}
const visited = new Set();
const queue = [[Math.floor(width / 2 / cell), Math.floor(height / 2 / cell)]];
while (queue.length) {
  const [x, y] = queue.shift();
  const key = `${x},${y}`;
  if (x < 1 || y < 1 || x >= columns - 1 || y >= rows - 1 || grid[y][x] || visited.has(key)) continue;
  visited.add(key);
  queue.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
}
for (const gadget of constant("GADGETS")) {
  const key = `${Math.floor(gadget.approachX / cell)},${Math.floor(gadget.approachY / cell)}`;
  assert(visited.has(key), `${gadget.id} is unreachable from the workspace`);
  console.log(`Reachable: ${gadget.id}`);
}
