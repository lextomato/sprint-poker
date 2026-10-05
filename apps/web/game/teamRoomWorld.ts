import Phaser from "phaser";
import * as EasyStar from "easystarjs";
import officeScene from "./officeScene.json";
import { TEAM_AVATAR_IDS, TeamAvailability, TeamZone, type ParticipantView, type TeamAvatarId } from "@planning/shared";
import { isDirectionalTeamAvatar, TEAM_AVATAR_DIRECTIONS, teamAvatarDirectionImage, teamAvatarFacingForVector, type TeamAvatarDirection } from "~/utils/teamAvatars";
import { canMoveInTeamRoom } from "~/utils/teamRoomKeyboard";

const WORLD_WIDTH = 1200;
const WORLD_HEIGHT = 700;
const AVATAR_SPEED = 220;
const ASSET_ROOT = "/game/team-room";
const NAV_CELL_SIZE = 20;
const NAV_COLUMNS = WORLD_WIDTH / NAV_CELL_SIZE;
const NAV_ROWS = WORLD_HEIGHT / NAV_CELL_SIZE;

export type TeamGadgetId = "daily-board" | "planning-table" | "retro-board" | "coffee-board";

interface WorldCallbacks {
  onMove: (x: number, y: number, zone: TeamZone) => void;
  onZoneChange: (zone: TeamZone) => void;
  onEnterZone: (zone: TeamZone) => void;
  onGadgetChange: (gadget: TeamGadgetId | null) => void;
  onOpenGadget: (gadget: TeamGadgetId) => void;
  onSelectMember: (participantId: string) => void;
  onReady?: () => void;
}

interface WorldOptions extends WorldCallbacks {
  participants: ParticipantView[];
  currentParticipantId: string;
  dark: boolean;
}

interface AvatarObjects {
  sprite: Phaser.Physics.Arcade.Sprite;
  shadow: Phaser.GameObjects.Ellipse;
  presence: Phaser.GameObjects.Ellipse;
  name: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  participant: ParticipantView;
  direction: TeamAvatarDirection;
  visualAvatarId: TeamAvatarId;
}

interface ZoneDefinition {
  id: TeamZone;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  door: "left" | "right";
  doorOffsetY: number;
}

interface GadgetDefinition {
  id: TeamGadgetId;
  zone: TeamZone;
  x: number;
  y: number;
  approachX: number;
  approachY: number;
  label: string;
  color: number;
  badgeX: number;
  badgeY: number;
}

const ZONES: ZoneDefinition[] = [
  { id: TeamZone.DAILY_ROOM, title: "DAILY", subtitle: "Standup", x: 30, y: 30, width: 350, height: 230, color: 0x469b80, door: "right", doorOffsetY: 135 },
  { id: TeamZone.PLANNING_ROOM, title: "PLANNING", subtitle: "Poker", x: 820, y: 30, width: 350, height: 230, color: 0x338d9e, door: "left", doorOffsetY: 135 },
  { id: TeamZone.RETROSPECTIVE_ROOM, title: "RETRO", subtitle: "Ideas", x: 30, y: 400, width: 430, height: 240, color: 0xc89332, door: "right", doorOffsetY: 135 },
  { id: TeamZone.COFFEE_AREA, title: "COFFEE", subtitle: "Pausa", x: 740, y: 400, width: 430, height: 240, color: 0xce7285, door: "left", doorOffsetY: 135 }
];

const GADGETS: GadgetDefinition[] = [
  { id: "daily-board", zone: TeamZone.DAILY_ROOM, x: 112, y: 116, approachX: 146, approachY: 233, label: "VER DAILY", color: 0x469b80, badgeX: 112, badgeY: 64 },
  { id: "planning-table", zone: TeamZone.PLANNING_ROOM, x: 966, y: 147, approachX: 966, approachY: 244, label: "SESIONES", color: 0x338d9e, badgeX: 878, badgeY: 64 },
  { id: "retro-board", zone: TeamZone.RETROSPECTIVE_ROOM, x: 128, y: 476, approachX: 154, approachY: 590, label: "RETROS", color: 0xc89332, badgeX: 128, badgeY: 423 },
  { id: "coffee-board", zone: TeamZone.COFFEE_AREA, x: 867, y: 476, approachX: 867, approachY: 590, label: "NOTAS", color: 0xce7285, badgeX: 867, badgeY: 423 }
];

const STATUS_COLORS: Record<TeamAvailability, number> = {
  [TeamAvailability.AVAILABLE]: 0x10b981,
  [TeamAvailability.FOCUS]: 0x3b82f6,
  [TeamAvailability.BUSY]: 0xf97316,
  [TeamAvailability.AWAY]: 0x94a3b8,
  [TeamAvailability.BREAK]: 0xeab308
};

const STATUS_LABELS: Record<TeamAvailability, string> = {
  [TeamAvailability.AVAILABLE]: "Disponible",
  [TeamAvailability.FOCUS]: "Concentrado",
  [TeamAvailability.BUSY]: "Ocupado",
  [TeamAvailability.AWAY]: "Ausente",
  [TeamAvailability.BREAK]: "Descanso"
};

function fallbackAvatar(participantId: string): TeamAvatarId {
  let hash = 0;
  for (const character of participantId) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return TEAM_AVATAR_IDS[Math.abs(hash) % TEAM_AVATAR_IDS.length]!;
}

function resolvedAvatarId(participant: ParticipantView) {
  return participant.avatarId ?? fallbackAvatar(participant.id);
}

function avatarKey(participant: ParticipantView, direction: TeamAvatarDirection) {
  const id = resolvedAvatarId(participant);
  return isDirectionalTeamAvatar(id) ? `avatar-${id}-${direction}` : `avatar-${id}`;
}

function zoneAt(x: number, y: number) {
  return ZONES.find((zone) => x >= zone.x && x <= zone.x + zone.width && y >= zone.y && y <= zone.y + zone.height)?.id ?? TeamZone.TEAM_ROOM;
}

export interface TeamRoomWorldHandle {
  destroy: () => void;
  syncParticipants: (participants: ParticipantView[]) => void;
}

export function createTeamRoomWorld(parent: HTMLElement, options: WorldOptions): TeamRoomWorldHandle {
  let scene: TeamRoomScene | null = null;

  class TeamRoomScene extends Phaser.Scene {
    private avatars = new Map<string, AvatarObjects>();
    private staticBodies: Phaser.GameObjects.GameObject[] = [];
    private player?: AvatarObjects;
    private pressedKeys = new Set<string>();
    private interactionRequested = false;
    private windowFocused = true;
    private target: Phaser.Math.Vector2 | null = null;
    private waypoints: Phaser.Math.Vector2[] = [];
    private navigationGrid: number[][] = [];
    private pathfinder = new EasyStar.js();
    private currentZone: TeamZone = TeamZone.TEAM_ROOM;
    private activeGadget: TeamGadgetId | null = null;
    private lastBroadcastAt = 0;
    private lastBroadcastX = -1;
    private lastBroadcastY = -1;

    constructor() {
      super("team-room");
      scene = this;
    }

    preload() {
      this.load.image("office-shell", `${ASSET_ROOT}/architecture/office-shell.png`);
      TEAM_AVATAR_IDS.forEach((id) => {
        if (isDirectionalTeamAvatar(id)) {
          TEAM_AVATAR_DIRECTIONS.forEach((direction) => this.load.image(
            `avatar-${id}-${direction}`,
            teamAvatarDirectionImage(id, direction)
          ));
        } else {
          this.load.image(`avatar-${id}`, `${ASSET_ROOT}/avatars-34/${id}.png`);
        }
      });
      this.load.image("modern-office", `${ASSET_ROOT}/modern-office/office-composition.webp`);
    }

    create() {
      this.physics.world.setBounds(20, 20, WORLD_WIDTH - 40, WORLD_HEIGHT - 40);
      this.drawWorld();
      this.setupPathfinder();
      const canvas = this.game.canvas;
      canvas.tabIndex = 0;
      canvas.setAttribute("aria-label", "Sala virtual del equipo. Usa WASD o las flechas para moverte.");
      const movementCodes = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
      const clearPressedKeys = () => {
        this.pressedKeys.clear();
        this.interactionRequested = false;
      };
      const onKeyDown = (event: KeyboardEvent) => {
        if (!canMoveInTeamRoom(document.activeElement, canvas, this.windowFocused)) return;
        if (movementCodes.has(event.code)) {
          event.preventDefault();
          this.pressedKeys.add(event.code);
        } else if (event.code === "KeyE" && !event.repeat) {
          event.preventDefault();
          this.interactionRequested = true;
        }
      };
      const onKeyUp = (event: KeyboardEvent) => this.pressedKeys.delete(event.code);
      const focusCanvas = () => canvas.focus({ preventScroll: true });
      const onWindowFocus = () => { this.windowFocused = true; };
      const onWindowBlur = () => {
        this.windowFocused = false;
        clearPressedKeys();
      };
      canvas.addEventListener("keydown", onKeyDown);
      canvas.addEventListener("keyup", onKeyUp);
      canvas.addEventListener("blur", clearPressedKeys);
      canvas.addEventListener("pointerdown", focusCanvas);
      window.addEventListener("focus", onWindowFocus);
      window.addEventListener("blur", onWindowBlur);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        canvas.removeEventListener("keydown", onKeyDown);
        canvas.removeEventListener("keyup", onKeyUp);
        canvas.removeEventListener("blur", clearPressedKeys);
        canvas.removeEventListener("pointerdown", focusCanvas);
        window.removeEventListener("focus", onWindowFocus);
        window.removeEventListener("blur", onWindowBlur);
      });
      this.syncParticipants(options.participants, true);
      if (this.player) {
        this.player.sprite.setCollideWorldBounds(true);
        this.staticBodies.forEach((body) => this.physics.add.collider(this.player!.sprite, body));
      }

      this.input.on("pointerdown", (pointer: Phaser.Input.Pointer, objects: Phaser.GameObjects.GameObject[]) => {
        if (objects.length || !this.player) return;
        this.requestPath(
          Phaser.Math.Clamp(pointer.worldX, 34, WORLD_WIDTH - 34),
          Phaser.Math.Clamp(pointer.worldY, 34, WORLD_HEIGHT - 34)
        );
      });
      options.onReady?.();
    }

    override update(time: number) {
      if (!this.player) return;
      const body = this.player.sprite.body as Phaser.Physics.Arcade.Body;
      const movementEnabled = canMoveInTeamRoom(document.activeElement, this.game.canvas, this.windowFocused);
      if (!movementEnabled) {
        this.pressedKeys.clear();
        this.interactionRequested = false;
        this.target = null;
        this.waypoints = [];
      }
      const left = movementEnabled && (this.pressedKeys.has("ArrowLeft") || this.pressedKeys.has("KeyA"));
      const right = movementEnabled && (this.pressedKeys.has("ArrowRight") || this.pressedKeys.has("KeyD"));
      const up = movementEnabled && (this.pressedKeys.has("ArrowUp") || this.pressedKeys.has("KeyW"));
      const down = movementEnabled && (this.pressedKeys.has("ArrowDown") || this.pressedKeys.has("KeyS"));
      const usingKeyboard = left || right || up || down;

      body.setVelocity(0);
      if (usingKeyboard) {
        this.target = null;
        this.waypoints = [];
        body.setVelocity((Number(right) - Number(left)) * AVATAR_SPEED, (Number(down) - Number(up)) * AVATAR_SPEED);
        body.velocity.normalize().scale(AVATAR_SPEED);
      } else if (movementEnabled && this.target) {
        const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, this.target.x, this.target.y);
        if (distance < 7) {
          this.waypoints.shift();
          this.target = this.waypoints[0] ?? null;
        } else {
          this.physics.moveToObject(this.player.sprite, this.target, AVATAR_SPEED);
        }
      }

      this.animatePlayer(body);
      this.updateAvatarDecorations();
      const nextZone = zoneAt(this.player.sprite.x, this.player.sprite.y);
      if (nextZone !== this.currentZone) {
        this.currentZone = nextZone;
        options.onZoneChange(nextZone);
        this.broadcastPosition(time, true);
      }
      const nearbyGadget = this.nearbyGadget();
      if (nearbyGadget?.id !== this.activeGadget) {
        this.activeGadget = nearbyGadget?.id ?? null;
        options.onGadgetChange(this.activeGadget);
      }
      if (movementEnabled && this.interactionRequested) {
        this.interactionRequested = false;
        if (this.activeGadget) options.onOpenGadget(this.activeGadget);
        else if (this.currentZone !== TeamZone.TEAM_ROOM) options.onEnterZone(this.currentZone);
      }
      if (body.velocity.lengthSq() > 0) this.broadcastPosition(time, false);
    }

    syncParticipants(participants: ParticipantView[], initial = false) {
      const ids = new Set(participants.map((participant) => participant.id));
      for (const [id, avatar] of this.avatars) {
        if (!ids.has(id)) {
          avatar.sprite.destroy();
          avatar.shadow.destroy();
          avatar.presence.destroy();
          avatar.name.destroy();
          avatar.status.destroy();
          this.avatars.delete(id);
        }
      }

      participants.forEach((participant, index) => {
        const existing = this.avatars.get(participant.id);
        const fallbackOffset = participant.positionX === 0.5 && participant.positionY === 0.5 ? ((index % 5) - 2) * 0.035 : 0;
        let x = Phaser.Math.Clamp((participant.positionX + fallbackOffset) * WORLD_WIDTH, 40, WORLD_WIDTH - 40);
        let y = Phaser.Math.Clamp(participant.positionY * WORLD_HEIGHT + Math.floor(index / 5) * 50, 42, WORLD_HEIGHT - 42);
        // A saved position can now be occupied by the redesigned furniture.
        if (!existing && participant.id === options.currentParticipantId) {
          const cell = this.toGridPoint(x, y);
          if (this.navigationGrid[cell.y]?.[cell.x] === 1) {
            const free = this.closestWalkablePoint(x, y, this.navigationGrid);
            x = free.x * NAV_CELL_SIZE + NAV_CELL_SIZE / 2;
            y = free.y * NAV_CELL_SIZE + NAV_CELL_SIZE / 2;
          }
        }
        if (existing) {
          existing.participant = participant;
          existing.status.setText(participant.activity || STATUS_LABELS[participant.availability]);
          existing.presence.setStrokeStyle(3, STATUS_COLORS[participant.availability], 1);
          if (participant.id !== options.currentParticipantId) {
            const dx = x - existing.sprite.x;
            const dy = y - existing.sprite.y;
            if (Math.hypot(dx, dy) > 1) this.setFacingDirection(existing, dx, dy);
            this.tweens.killTweensOf(existing.sprite);
            this.tweens.add({ targets: existing.sprite, x, y, duration: initial ? 0 : 140, ease: "Sine.easeOut" });
          }
          this.updateAvatarTexture(existing, participant);
          return;
        }
        const avatar = this.createAvatar(participant, x, y);
        this.avatars.set(participant.id, avatar);
        if (participant.id === options.currentParticipantId) {
          this.player = avatar;
          this.currentZone = zoneAt(x, y);
          options.onZoneChange(this.currentZone);
        }
      });
      this.updateAvatarDecorations();
    }

    private drawWorld() {
      this.cameras.main.setBackgroundColor(options.dark ? 0x252e30 : 0xe8edeb);
      this.add.image(0, 0, "office-shell")
        .setOrigin(0)
        .setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT)
        .setDepth(-20);
      ZONES.forEach((zone) => this.drawRoom(zone));
      this.drawOfficeFurniture();
      this.drawGadgets();
      this.add.text(600, 48, "TEAM WORKSPACE", { fontFamily: "Inter, sans-serif", fontSize: "13px", fontStyle: "bold", color: options.dark ? "#cad8d1" : "#576960" }).setOrigin(0.5).setDepth(20);
    }

    private drawRoom(zone: ZoneDefinition) {
      const doorY = zone.y + zone.doorOffsetY;
      const topHeight = doorY - 38 - zone.y;
      const bottomHeight = zone.y + zone.height - doorY - 38;
      if (zone.door === "right") {
        this.addWall(zone.x, zone.y + zone.height / 2, 10, zone.height);
        this.addWall(zone.x + zone.width, zone.y + topHeight / 2, 10, topHeight);
        this.addWall(zone.x + zone.width, doorY + 38 + bottomHeight / 2, 10, bottomHeight);
      } else {
        this.addWall(zone.x + zone.width, zone.y + zone.height / 2, 10, zone.height);
        this.addWall(zone.x, zone.y + topHeight / 2, 10, topHeight);
        this.addWall(zone.x, doorY + 38 + bottomHeight / 2, 10, bottomHeight);
      }
      this.addWall(zone.x + zone.width / 2, zone.y, zone.width, 10);
      this.addWall(zone.x + zone.width / 2, zone.y + zone.height, zone.width, 10);

      const dot = this.add.circle(14, 13, 5, zone.color);
      const title = this.add.text(25, 6, zone.title, { fontFamily: "Inter, sans-serif", fontSize: "13px", fontStyle: "bold", color: options.dark ? "#f1f6f2" : "#344b46" });
      const labelWidth = title.width + 38;
      const label = this.add.container(zone.x + zone.width / 2 - labelWidth / 2, zone.y + 12).setDepth(1901);
      const background = this.add.graphics();
      background.fillStyle(options.dark ? 0x273638 : 0xffffff, 0.94).fillRoundedRect(0, 0, labelWidth, 27, 7);
      background.lineStyle(1, zone.color, 0.34).strokeRoundedRect(0, 0, labelWidth, 27, 7);
      label.add([background, dot, title]);
    }

    private drawOfficeFurniture() {
      const texture = this.textures.get("modern-office");
      for (const fixture of officeScene.fixtures) {
        const { id, x, y, width, height, depth, collider } = fixture;
        const worldX = fixture.worldX ?? x;
        const worldY = fixture.worldY ?? y;
        texture.add(id, 0, x * officeScene.density, y * officeScene.density, width * officeScene.density, height * officeScene.density);
        this.add.image(worldX, worldY, "modern-office", id).setOrigin(0).setDisplaySize(width, height).setDepth(depth);
        if (collider) this.addWall(collider.x, collider.y, collider.width, collider.height);
      }
    }

    private drawGadgets() {
      GADGETS.forEach((gadget) => {
        const ring = this.add.ellipse(gadget.approachX, gadget.approachY, 46, 19, gadget.color, 0.08)
          .setStrokeStyle(1.5, gadget.color, 0.6)
          .setDepth(0);
        this.tweens.add({ targets: ring, alpha: 0.4, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

        const badge = this.add.container(gadget.badgeX, gadget.badgeY).setDepth(1904).setSize(88, 26).setInteractive({ useHandCursor: true });
        const background = this.add.graphics();
        background.fillStyle(options.dark ? 0x273638 : 0xffffff, 0.98).fillRoundedRect(-44, -13, 88, 26, 6);
        background.lineStyle(1, gadget.color, 0.6).strokeRoundedRect(-44, -13, 88, 26, 6);
        const dot = this.add.circle(-29, 0, 4, gadget.color);
        const label = this.add.text(-20, -6, gadget.label, {
          fontFamily: "Inter, sans-serif",
          fontSize: "9px",
          fontStyle: "bold",
          color: options.dark ? "#f8fafc" : "#0f172a"
        });
        badge.add([background, dot, label]);
        badge.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          if (!this.player) return;
          if (Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, gadget.approachX, gadget.approachY) <= 82) {
            options.onOpenGadget(gadget.id);
            return;
          }
          this.requestPath(gadget.approachX, gadget.approachY);
        });
      });
    }

    private nearbyGadget() {
      if (!this.player) return undefined;
      return GADGETS.find((gadget) => gadget.zone === this.currentZone && Phaser.Math.Distance.Between(
        this.player!.sprite.x,
        this.player!.sprite.y,
        gadget.approachX,
        gadget.approachY
      ) <= 82);
    }


    private addWall(x: number, y: number, width: number, height: number) {
      const wall = this.add.rectangle(x, y, width, height, 0xffffff, 0);
      this.physics.add.existing(wall, true);
      this.staticBodies.push(wall);
    }

    private setupPathfinder() {
      this.navigationGrid = Array.from({ length: NAV_ROWS }, () => Array<number>(NAV_COLUMNS).fill(0));
      for (const object of this.staticBodies) {
        const bounds = (object as Phaser.GameObjects.GameObject & { getBounds: () => Phaser.Geom.Rectangle }).getBounds();
        const minColumn = Phaser.Math.Clamp(Math.floor((bounds.left - 13) / NAV_CELL_SIZE), 0, NAV_COLUMNS - 1);
        const maxColumn = Phaser.Math.Clamp(Math.floor((bounds.right + 13) / NAV_CELL_SIZE), 0, NAV_COLUMNS - 1);
        const minRow = Phaser.Math.Clamp(Math.floor((bounds.top - 13) / NAV_CELL_SIZE), 0, NAV_ROWS - 1);
        const maxRow = Phaser.Math.Clamp(Math.floor((bounds.bottom + 13) / NAV_CELL_SIZE), 0, NAV_ROWS - 1);
        for (let row = minRow; row <= maxRow; row += 1) {
          for (let column = minColumn; column <= maxColumn; column += 1) this.navigationGrid[row]![column] = 1;
        }
      }
      for (let column = 0; column < NAV_COLUMNS; column += 1) {
        this.navigationGrid[0]![column] = 1;
        this.navigationGrid[NAV_ROWS - 1]![column] = 1;
      }
      for (let row = 0; row < NAV_ROWS; row += 1) {
        this.navigationGrid[row]![0] = 1;
        this.navigationGrid[row]![NAV_COLUMNS - 1] = 1;
      }
      this.pathfinder.setAcceptableTiles([0]);
      this.pathfinder.enableDiagonals();
      this.pathfinder.disableCornerCutting();
      this.pathfinder.enableSync();
    }

    private requestPath(destinationX: number, destinationY: number) {
      if (!this.player) return;
      const grid = this.navigationGrid.map((row) => [...row]);
      const start = this.toGridPoint(this.player.sprite.x, this.player.sprite.y);
      const destination = this.closestWalkablePoint(destinationX, destinationY, grid);
      this.clearGridAround(grid, start.x, start.y, 1);
      this.clearGridAround(grid, destination.x, destination.y, 1);
      this.pathfinder.setGrid(grid);
      this.pathfinder.findPath(start.x, start.y, destination.x, destination.y, (path) => {
        if (!path?.length) {
          this.waypoints = [];
          this.target = null;
          return;
        }
        const route = path.map((point) => new Phaser.Math.Vector2(
          point.x * NAV_CELL_SIZE + NAV_CELL_SIZE / 2,
          point.y * NAV_CELL_SIZE + NAV_CELL_SIZE / 2
        ));
        this.waypoints = this.simplifyRoute(route);
        const finalPoint = this.waypoints.at(-1);
        if (finalPoint && Phaser.Math.Distance.Between(finalPoint.x, finalPoint.y, destinationX, destinationY) < NAV_CELL_SIZE * 1.5) {
          finalPoint.set(destinationX, destinationY);
        }
        this.target = this.waypoints[0] ?? null;
      });
      this.pathfinder.calculate();
    }

    private toGridPoint(x: number, y: number) {
      return {
        x: Phaser.Math.Clamp(Math.floor(x / NAV_CELL_SIZE), 1, NAV_COLUMNS - 2),
        y: Phaser.Math.Clamp(Math.floor(y / NAV_CELL_SIZE), 1, NAV_ROWS - 2)
      };
    }

    private closestWalkablePoint(x: number, y: number, grid: number[][]) {
      const point = this.toGridPoint(x, y);
      if (grid[point.y]![point.x] === 0) return point;
      for (let radius = 1; radius < 8; radius += 1) {
        let nearest: { x: number; y: number; distance: number } | null = null;
        for (let row = point.y - radius; row <= point.y + radius; row += 1) {
          for (let column = point.x - radius; column <= point.x + radius; column += 1) {
            if (row < 1 || row >= NAV_ROWS - 1 || column < 1 || column >= NAV_COLUMNS - 1 || grid[row]![column] !== 0) continue;
            const distance = Phaser.Math.Distance.Between(column, row, point.x, point.y);
            if (!nearest || distance < nearest.distance) nearest = { x: column, y: row, distance };
          }
        }
        if (nearest) return { x: nearest.x, y: nearest.y };
      }
      return point;
    }

    private clearGridAround(grid: number[][], column: number, row: number, radius: number) {
      for (let y = Math.max(1, row - radius); y <= Math.min(NAV_ROWS - 2, row + radius); y += 1) {
        for (let x = Math.max(1, column - radius); x <= Math.min(NAV_COLUMNS - 2, column + radius); x += 1) grid[y]![x] = 0;
      }
    }

    private simplifyRoute(route: Phaser.Math.Vector2[]) {
      if (route.length < 3) return route.slice(1);
      const simplified: Phaser.Math.Vector2[] = [];
      let previousDirection = "";
      for (let index = 1; index < route.length; index += 1) {
        const previous = route[index - 1]!;
        const current = route[index]!;
        const direction = `${Math.sign(current.x - previous.x)},${Math.sign(current.y - previous.y)}`;
        if (previousDirection && direction !== previousDirection) simplified.push(previous.clone());
        previousDirection = direction;
      }
      simplified.push(route.at(-1)!.clone());
      return simplified;
    }

    private createAvatar(participant: ParticipantView, x: number, y: number): AvatarObjects {
      const shadow = this.add.ellipse(x, y + 18, 34, 15, 0x0f172a, 0.3).setDepth(y - 2);
      const presence = this.add.ellipse(x, y + 8, 44, 34, 0xffffff, 0.05).setStrokeStyle(3, STATUS_COLORS[participant.availability], 1).setDepth(y - 1);
      const direction: TeamAvatarDirection = "front";
      const directional = isDirectionalTeamAvatar(resolvedAvatarId(participant));
      const sprite = this.physics.add.sprite(x, y, avatarKey(participant, direction)).setScale(directional ? 0.14 : 3.2).setDepth(y);
      if (directional) sprite.body!.setSize(220, 180).setOffset(82, 282);
      else sprite.body!.setSize(10, 8).setOffset(3, 8);
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", (_pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation();
        options.onSelectMember(participant.id);
      });
      const displayName = participant.id === options.currentParticipantId ? `${participant.displayName} · tú` : participant.displayName;
      const name = this.add.text(x, y + 34, displayName, {
        fontFamily: "Inter, sans-serif", fontSize: "11px", fontStyle: "bold",
        color: options.dark ? "#f8fafc" : "#0f172a", backgroundColor: options.dark ? "#111827e8" : "#fffffff0",
        padding: { x: 5, y: 2 }
      }).setOrigin(0.5).setDepth(2000);
      const status = this.add.text(x, y + 51, participant.activity || STATUS_LABELS[participant.availability], {
        fontFamily: "Inter, sans-serif", fontSize: "9px", color: options.dark ? "#cbd5e1" : "#475569",
        backgroundColor: options.dark ? "#0f172ad9" : "#f8fafce8", padding: { x: 4, y: 2 }, wordWrap: { width: 126 }
      }).setOrigin(0.5).setDepth(2000);
      return { sprite, shadow, presence, name, status, participant, direction, visualAvatarId: resolvedAvatarId(participant) };
    }

    private updateAvatarTexture(avatar: AvatarObjects, participant: ParticipantView) {
      const avatarId = resolvedAvatarId(participant);
      const directional = isDirectionalTeamAvatar(avatarId);
      const texture = avatarKey(participant, avatar.direction);
      if (avatar.sprite.texture.key !== texture) avatar.sprite.setTexture(texture);
      if (avatar.visualAvatarId !== avatarId) {
        avatar.sprite.setScale(directional ? 0.14 : 3.2);
        const body = avatar.sprite.body as Phaser.Physics.Arcade.Body;
        if (directional) body.setSize(220, 180).setOffset(82, 282);
        else body.setSize(10, 8).setOffset(3, 8);
        avatar.visualAvatarId = avatarId;
      }
      avatar.sprite.setFlipX(!directional && avatar.direction.includes("left"));
    }

    private animatePlayer(body: Phaser.Physics.Arcade.Body) {
      if (!this.player) return;
      const moving = body.velocity.lengthSq() > 0;
      if (moving) {
        const direction = teamAvatarFacingForVector(body.velocity.x, body.velocity.y);
        if (direction && direction !== this.player.direction) {
          this.player.direction = direction;
          this.updateAvatarTexture(this.player, this.player.participant);
        }
      }
    }

    private setFacingDirection(avatar: AvatarObjects, dx: number, dy: number) {
      const direction = teamAvatarFacingForVector(dx, dy);
      if (!direction || direction === avatar.direction) return;
      avatar.direction = direction;
    }

    private updateAvatarDecorations() {
      for (const avatar of this.avatars.values()) {
        const { x, y } = avatar.sprite;
        const directional = isDirectionalTeamAvatar(resolvedAvatarId(avatar.participant));
        avatar.shadow.setPosition(x, y + (directional ? 37 : 18)).setDepth(y - 2);
        avatar.presence.setPosition(x, y + 8).setDepth(y - 1);
        avatar.sprite.setDepth(y);
        avatar.name.setPosition(x, y + (directional ? 43 : 35));
        avatar.status.setPosition(x, y + (directional ? 60 : 52));
      }
    }

    private broadcastPosition(time: number, force: boolean) {
      if (!this.player) return;
      const x = Number((this.player.sprite.x / WORLD_WIDTH).toFixed(4));
      const y = Number((this.player.sprite.y / WORLD_HEIGHT).toFixed(4));
      const moved = Math.abs(x - this.lastBroadcastX) + Math.abs(y - this.lastBroadcastY) > 0.003;
      if (!force && (time - this.lastBroadcastAt < 160 || !moved)) return;
      this.lastBroadcastAt = time;
      this.lastBroadcastX = x;
      this.lastBroadcastY = y;
      options.onMove(x, y, this.currentZone);
    }
  }

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    backgroundColor: options.dark ? "#111827" : "#dde5e7",
    transparent: false,
    render: { antialias: true, pixelArt: false, roundPixels: false },
    input: { activePointers: 2 },
    physics: { default: "arcade", arcade: { gravity: { x: 0, y: 0 }, debug: false } },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    scene: TeamRoomScene
  });

  return {
    destroy: () => game.destroy(true),
    syncParticipants: (participants) => scene?.syncParticipants(participants)
  };
}
