import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// The licensed source kit stays outside the repository. Only the composed
// office artwork is shipped; this script never copies standalone source PNGs.
const source = process.argv[2];
if (!source) throw new Error("Usage: node scripts/build-office-scene.mjs <ModernOffice2DProps_v1.0 directory>");
const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "apps/web/public/game/team-room/modern-office");
const inventory = JSON.parse(await fs.readFile(path.join(source, "Documentation/ASSET_LIST.json"), "utf8"));
const assets = new Map(inventory.assets.map((asset) => [asset.name, asset]));
const density = 2;
const layers = [];
const fixtures = [];
const DISPLAY_OFFSETS = {
  "daily-plant": { x: 101, y: -25 },
  "planning-table": { x: -23, y: 0 },
  "retro-plant": { x: 105, y: -27 },
  "coffee-plant": { x: -8, y: -21 }
};

const item = (name, x, y, width, flip = false) => ({ name, x, y, width, flip });
async function fixture(id, x, y, width, height, items, collider, illustration = "") {
  if (x < 0 || y < 0 || x + width > 1200 || y + height > 700) throw new Error(`Fixture outside office: ${id}`);
  if (fixtures.some((other) => x < other.x + other.width && x + width > other.x && y < other.y + other.height && y + height > other.y)) {
    throw new Error(`Overlapping composition frames: ${id}`);
  }
  const inputs = [];
  if (illustration) inputs.push({ input: Buffer.from(`<svg width="${width * density}" height="${height * density}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${illustration}</svg>`), left: 0, top: 0 });
  for (const piece of items) {
    const asset = assets.get(piece.name);
    if (!asset) throw new Error(`Unknown asset: ${piece.name}`);
    if (piece.x < 0 || piece.y < 0 || piece.x + piece.width > width || piece.y + Math.ceil(piece.width * asset.height / asset.width) > height) {
      throw new Error(`Clipped ${piece.name} in ${id}`);
    }
    let image = sharp(path.join(source, "Tiles", asset.file)).resize(Math.round(piece.width * density));
    if (piece.flip) image = image.flop();
    inputs.push({ input: await image.toBuffer(), left: Math.round(piece.x * density), top: Math.round(piece.y * density) });
  }
  const buffer = await sharp({ create: { width: width * density, height: height * density, channels: 4, background: "#00000000" } }).composite(inputs).png().toBuffer();
  layers.push({ input: buffer, left: x * density, top: y * density });
  const offset = DISPLAY_OFFSETS[id] ?? { x: 0, y: 0 };
  const displayCollider = collider ? { ...collider, x: collider.x + offset.x, y: collider.y + offset.y } : null;
  const displayX = x + offset.x;
  const displayY = y + offset.y;
  fixtures.push({
    id, x, y, width, height, worldX: displayX, worldY: displayY,
    depth: displayCollider ? displayCollider.y + displayCollider.height / 2 : displayY + height - 12,
    collider: displayCollider
  });
}

function boardArt(color, notes = false) {
  return `<ellipse cx="59" cy="111" rx="47" ry="5" fill="#243b3b" opacity=".1"/>
    <path d="M24 76L18 108M92 79L101 110" stroke="#384d51" stroke-width="5" stroke-linecap="round"/>
    <path d="M7 7L111 17L111 86L7 76Z" fill="#dae2df" stroke="#455a60" stroke-width="2.5"/>
    <path d="M12 12L106 21L106 80L12 71Z" fill="${notes ? "#edf0da" : "#fcfdf9"}"/>
    <path d="M18 26L71 31" stroke="${color}" stroke-width="4" stroke-linecap="round"/>
    ${notes ? [0, 1, 2].map((i) => `<path d="M${19 + i * 27} 40l20 2v22l-20 -2Z" fill="${["#f5c558", "#89c8b6", "#eca8ac"][i]}"/><path d="M${23 + i * 27} 48l11 1m-11 5l8 1" stroke="#52645f" opacity=".45"/>`).join("") : `<path d="M21 40l4 4 6 -6M21 53l4 4 6 -6" fill="none" stroke="${color}" stroke-width="2"/><path d="M39 43l48 4M39 56l35 3" stroke="#b5c6c5" stroke-width="3" stroke-linecap="round"/>`}`;
}

// Furnished workstations are composed as a single layer, including desk props.
for (const [index, x, y] of [[0, 435, 100], [1, 650, 100], [2, 435, 294], [3, 650, 294]]) {
  await fixture(`workstation-${index}`, x, y, 130, 144, [
    item("desk_straight", 0, 29, 128), item("laptop_open_off", 44, 14, 43),
    item("mug", 94, 34, 15), item("succulent_small", 8, 18, 24),
    item("chair_task", 42, 73, 43)
  ], { x: x + 62, y: y + 70, width: 108, height: 48 });
}
await fixture("reception", 523, 540, 154, 127, [item("counter_reception_curved", 0, 12, 154), item("monitor_single_off", 48, 0, 43), item("pen_cup", 112, 13, 17)], { x: 600, y: 615, width: 125, height: 44 });
await fixture("workspace-greenery", 688, 570, 45, 64, [item("tree_indoor", 0, 0, 45)], { x: 710, y: 620, width: 26, height: 22 });

await fixture("daily-board", 53, 79, 120, 118, [], { x: 112, y: 177, width: 95, height: 18 }, boardArt("#469b80"));
await fixture("daily-huddle", 205, 90, 150, 143, [
  item("chair_meeting", 0, 6, 43), item("chair_meeting", 92, 6, 43, true),
  item("desk_standing", 22, 46, 105), item("clipboard_blank", 51, 46, 27), item("water_bottle", 92, 42, 13)
], { x: 280, y: 180, width: 89, height: 38 });
await fixture("daily-plant", 55, 218, 47, 65, [item("plant_broadleaf", 0, 0, 47)], { x: 79, y: 270, width: 22, height: 18 });

await fixture("planning-table", 881, 102, 216, 156, [
  item("chair_visitor", 31, 0, 38), item("chair_visitor", 137, 0, 38, true),
  item("desk_modesty_panel", 0, 39, 109), item("desk_modesty_panel", 106, 47, 109),
  item("laptop_open_off", 38, 22, 40), item("notebook_closed", 126, 53, 28), item("mug", 174, 53, 16),
  item("chair_meeting", 7, 92, 39), item("chair_meeting", 163, 100, 39, true)
], { x: 989, y: 192, width: 190, height: 38 });
await fixture("planning-storage", 1098, 61, 58, 126, [item("cabinet_filing_tall", 8, 27, 47), item("plant_snake", 0, 0, 30)], { x: 1125, y: 160, width: 35, height: 27 });

await fixture("retro-board", 69, 439, 120, 118, [], { x: 128, y: 538, width: 95, height: 18 }, boardArt("#c89332", true));
await fixture("retro-workshop", 218, 455, 196, 168, [
  item("chair_visitor", 17, 0, 38), item("chair_visitor", 128, 0, 38, true),
  item("desk_straight", 0, 46, 102), item("desk_straight", 94, 53, 102),
  item("folder_closed", 17, 55, 24), item("papers_stack", 119, 58, 27), item("pen_cup", 163, 42, 18),
  item("chair_meeting", 28, 103, 41), item("chair_meeting", 117, 110, 41, true)
], { x: 316, y: 550, width: 174, height: 35 });
await fixture("retro-plant", 55, 582, 52, 70, [item("plant_palm", 0, 0, 52)], { x: 81, y: 636, width: 26, height: 22 });

await fixture("coffee-board", 808, 439, 120, 118, [], { x: 867, y: 538, width: 95, height: 18 }, boardArt("#ce7285", true));
await fixture("coffee-bar", 932, 427, 148, 130, [
  item("credenza_low", 0, 29, 145), item("mug", 40, 29, 16), item("mug", 63, 31, 16),
  item("succulent_small", 101, 11, 24), item("water_bottle", 16, 14, 14)
], { x: 1005, y: 524, width: 128, height: 34 });
await fixture("coffee-fridge", 1091, 441, 63, 95, [item("refrigerator_compact", 0, 0, 63)], { x: 1122, y: 515, width: 46, height: 30 });
await fixture("coffee-seating", 932, 559, 156, 99, [
  item("desk_standing", 17, 0, 100), item("notebook_closed", 44, 9, 24), item("mug", 86, 5, 15),
  item("stool_high", 0, 39, 34), item("stool_high", 118, 44, 34)
], { x: 1000, y: 610, width: 86, height: 24 });
await fixture("coffee-plant", 1113, 566, 46, 79, [item("plant_snake", 0, 0, 46)], { x: 1136, y: 628, width: 27, height: 21 });

await fs.mkdir(output, { recursive: true });
await sharp({ create: { width: 2400, height: 1400, channels: 4, background: "#00000000" } })
  .composite(layers).webp({ quality: 90, alphaQuality: 100 }).toFile(path.join(output, "office-composition.webp"));
await fs.writeFile(path.join(root, "apps/web/game/officeScene.json"), JSON.stringify({ density, fixtures }, null, 2) + "\n");
console.log(`Composed ${fixtures.length} furnished fixtures into office-composition.webp`);
