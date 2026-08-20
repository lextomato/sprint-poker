import Phaser from "phaser";
import * as EasyStar from "easystarjs";
import { TEAM_AVATAR_IDS, TeamAvailability, TeamZone, type ParticipantView, type TeamAvatarId } from "@planning/shared";

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
  floor: number;
  door: "left" | "right";
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
}

const ZONES: ZoneDefinition[] = [
  { id: TeamZone.DAILY_ROOM, title: "DAILY", subtitle: "Standup", x: 30, y: 30, width: 350, height: 270, color: 0x10b981, floor: 1, door: "right" },
  { id: TeamZone.PLANNING_ROOM, title: "PLANNING", subtitle: "Poker", x: 820, y: 30, width: 350, height: 270, color: 0x06b6d4, floor: 14, door: "left" },
  { id: TeamZone.RETROSPECTIVE_ROOM, title: "RETRO", subtitle: "Ideas", x: 30, y: 400, width: 430, height: 270, color: 0xf59e0b, floor: 42, door: "right" },
  { id: TeamZone.COFFEE_AREA, title: "COFFEE", subtitle: "Pausa", x: 740, y: 400, width: 430, height: 270, color: 0xf43f5e, floor: 43, door: "left" }
];

const GADGETS: GadgetDefinition[] = [
  { id: "daily-board", zone: TeamZone.DAILY_ROOM, x: 88, y: 82, approachX: 112, approachY: 125, label: "VER DAILY", color: 0x10b981 },
  { id: "planning-table", zone: TeamZone.PLANNING_ROOM, x: 982, y: 170, approachX: 982, approachY: 235, label: "SESIONES", color: 0x06b6d4 },
  { id: "retro-board", zone: TeamZone.RETROSPECTIVE_ROOM, x: 150, y: 445, approachX: 210, approachY: 485, label: "RETROS", color: 0xf59e0b },
  { id: "coffee-board", zone: TeamZone.COFFEE_AREA, x: 805, y: 454, approachX: 850, approachY: 510, label: "NOTAS", color: 0xf43f5e }
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

const PERSPECTIVE_ASSETS = [
  "desk", "chair-front", "chair-side", "sofa-left", "sofa-middle", "sofa-right",
  "cabinet", "drawer", "locker", "plant-tree", "plant-round", "plant-small",
  "board", "bookshelf-left", "bookshelf-middle", "bookshelf-right"
] as const;
const OFFICE_ASSETS = [
  1, 8, 14, 42, 43, 134, 158, 159, 262, 264, 271, 274, 275, 276,
  294, 295, 296, 297, 323, 447, 448, 449, 450, 454, 455, 456,
  474, 475, 476, 480, 481, 482, 483, 506, 507, 528, 529, 530, 531
];

function officeKey(id: number) {
  return `office-${id}`;
}

function officeFile(id: number) {
  return `tile_${String(id).padStart(2, "0")}.png`;
}

function fallbackAvatar(participantId: string): TeamAvatarId {
  let hash = 0;
  for (const character of participantId) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return TEAM_AVATAR_IDS[Math.abs(hash) % TEAM_AVATAR_IDS.length]!;
}

function avatarKey(participant: ParticipantView) {
  return `avatar-${participant.avatarId ?? fallbackAvatar(participant.id)}`;
}

function perspectiveKey(asset: (typeof PERSPECTIVE_ASSETS)[number]) {
  return `perspective-${asset}`;
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
    private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
    private keys!: Record<"W" | "A" | "S" | "D" | "E", Phaser.Input.Keyboard.Key>;
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
      TEAM_AVATAR_IDS.forEach((id) => this.load.image(`avatar-${id}`, `${ASSET_ROOT}/avatars-34/${id}.png`));
      PERSPECTIVE_ASSETS.forEach((asset) => this.load.image(perspectiveKey(asset), `${ASSET_ROOT}/perspective/${asset}.png`));
      OFFICE_ASSETS.forEach((id) => this.load.image(officeKey(id), `${ASSET_ROOT}/objects/${officeFile(id)}`));
    }

    create() {
      this.physics.world.setBounds(20, 20, WORLD_WIDTH - 40, WORLD_HEIGHT - 40);
      this.drawWorld();
      this.setupPathfinder();
      this.cursors = this.input.keyboard!.createCursorKeys();
      this.keys = this.input.keyboard!.addKeys("W,A,S,D,E") as typeof this.keys;
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
      const left = this.cursors.left.isDown || this.keys.A.isDown;
      const right = this.cursors.right.isDown || this.keys.D.isDown;
      const up = this.cursors.up.isDown || this.keys.W.isDown;
      const down = this.cursors.down.isDown || this.keys.S.isDown;
      const usingKeyboard = left || right || up || down;

      body.setVelocity(0);
      if (usingKeyboard) {
        this.target = null;
        this.waypoints = [];
        body.setVelocity((Number(right) - Number(left)) * AVATAR_SPEED, (Number(down) - Number(up)) * AVATAR_SPEED);
        body.velocity.normalize().scale(AVATAR_SPEED);
      } else if (this.target) {
        const distance = Phaser.Math.Distance.Between(this.player.sprite.x, this.player.sprite.y, this.target.x, this.target.y);
        if (distance < 7) {
          this.waypoints.shift();
          this.target = this.waypoints[0] ?? null;
        } else {
          this.physics.moveToObject(this.player.sprite, this.target, AVATAR_SPEED);
        }
      }

      this.animatePlayer(time, body);
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
      if (Phaser.Input.Keyboard.JustDown(this.keys.E)) {
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
        const x = Phaser.Math.Clamp((participant.positionX + fallbackOffset) * WORLD_WIDTH, 40, WORLD_WIDTH - 40);
        const y = Phaser.Math.Clamp(participant.positionY * WORLD_HEIGHT + Math.floor(index / 5) * 50, 42, WORLD_HEIGHT - 42);
        if (existing) {
          existing.participant = participant;
          existing.sprite.setTexture(avatarKey(participant));
          existing.status.setText(participant.activity || STATUS_LABELS[participant.availability]);
          existing.presence.setStrokeStyle(3, STATUS_COLORS[participant.availability], 1);
          if (participant.id !== options.currentParticipantId) {
            const dx = x - existing.sprite.x;
            if (Math.abs(dx) > 1) existing.sprite.setFlipX(dx < 0);
            this.tweens.killTweensOf(existing.sprite);
            this.tweens.add({ targets: existing.sprite, x, y, duration: initial ? 0 : 140, ease: "Sine.easeOut" });
          }
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
      this.cameras.main.setBackgroundColor(options.dark ? 0x111827 : 0xdde5e7);
      this.add.tileSprite(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, officeKey(8)).setTint(options.dark ? 0x68747a : 0xc9d2d5).setDepth(-10);
      ZONES.forEach((zone) => this.drawRoom(zone));
      this.drawCentralWorkspace();
      this.drawDailyRoom();
      this.drawPlanningRoom();
      this.drawRetroRoom();
      this.drawCoffeeRoom();
      this.drawGadgets();

      const border = this.add.graphics().setDepth(1900);
      border.lineStyle(8, options.dark ? 0x111827 : 0x334155, 1).strokeRect(16, 16, WORLD_WIDTH - 32, WORLD_HEIGHT - 32);
    }

    private drawRoom(zone: ZoneDefinition) {
      this.add.tileSprite(zone.x + zone.width / 2, zone.y + zone.height / 2, zone.width - 12, zone.height - 12, officeKey(zone.floor))
        .setTint(options.dark ? 0xaab1b7 : 0xffffff)
        .setDepth(-5);

      const wallColor = options.dark ? 0x1f2937 : 0x334155;
      const wall = this.add.graphics().setDepth(1800);
      wall.lineStyle(9, wallColor, 1);
      wall.lineBetween(zone.x, zone.y, zone.x + zone.width, zone.y);
      wall.lineBetween(zone.x, zone.y + zone.height, zone.x + zone.width, zone.y + zone.height);
      const doorY = zone.y + zone.height / 2;
      const topHeight = doorY - 38 - zone.y;
      const bottomHeight = zone.y + zone.height - doorY - 38;
      if (zone.door === "right") {
        wall.lineBetween(zone.x, zone.y, zone.x, zone.y + zone.height);
        wall.lineBetween(zone.x + zone.width, zone.y, zone.x + zone.width, doorY - 38);
        wall.lineBetween(zone.x + zone.width, doorY + 38, zone.x + zone.width, zone.y + zone.height);
        this.addWall(zone.x, zone.y + zone.height / 2, 10, zone.height);
        this.addWall(zone.x + zone.width, zone.y + topHeight / 2, 10, topHeight);
        this.addWall(zone.x + zone.width, doorY + 38 + bottomHeight / 2, 10, bottomHeight);
      } else {
        wall.lineBetween(zone.x + zone.width, zone.y, zone.x + zone.width, zone.y + zone.height);
        wall.lineBetween(zone.x, zone.y, zone.x, doorY - 38);
        wall.lineBetween(zone.x, doorY + 38, zone.x, zone.y + zone.height);
        this.addWall(zone.x + zone.width, zone.y + zone.height / 2, 10, zone.height);
        this.addWall(zone.x, zone.y + topHeight / 2, 10, topHeight);
        this.addWall(zone.x, doorY + 38 + bottomHeight / 2, 10, bottomHeight);
      }
      this.addWall(zone.x + zone.width / 2, zone.y, zone.width, 10);
      this.addWall(zone.x + zone.width / 2, zone.y + zone.height, zone.width, 10);

      const label = this.add.container(zone.x + 18, zone.y + 17).setDepth(1901);
      const badge = this.add.rectangle(0, 0, 116, 40, options.dark ? 0x111827 : 0xffffff, 0.94).setOrigin(0).setStrokeStyle(2, zone.color);
      const dot = this.add.circle(14, 13, 5, zone.color);
      const title = this.add.text(25, 6, zone.title, { fontFamily: "Inter, sans-serif", fontSize: "12px", fontStyle: "bold", color: options.dark ? "#f8fafc" : "#0f172a" });
      const subtitle = this.add.text(14, 22, zone.subtitle, { fontFamily: "Inter, sans-serif", fontSize: "9px", color: options.dark ? "#94a3b8" : "#64748b" });
      label.add([badge, dot, title, subtitle]);
    }

    private drawCentralWorkspace() {
      const panel = this.add.graphics().setDepth(-3);
      panel.fillStyle(options.dark ? 0x172033 : 0xe8eef0, 0.9).fillRoundedRect(405, 32, 390, 636, 12);
      panel.lineStyle(2, options.dark ? 0x334155 : 0xb8c5ca, 1).strokeRoundedRect(405, 32, 390, 636, 12);
      this.add.text(600, 50, "TEAM WORKSPACE", { fontFamily: "Inter, sans-serif", fontSize: "13px", fontStyle: "bold", color: options.dark ? "#cbd5e1" : "#475569" }).setOrigin(0.5).setDepth(20);
      [
        [500, 145], [700, 145], [500, 330], [700, 330], [600, 535]
      ].forEach(([x, y], index) => {
        this.addPerspective("desk", x!, y!, 4.3, true);
        this.addPerspective(index % 2 ? "chair-side" : "chair-front", x!, y! + 37, 3.2, false, index % 2 === 1);
      });
      this.addPerspective("plant-tree", 440, 95, 3.4, false);
      this.addPerspective("plant-round", 758, 626, 3.5, false);
      this.addPerspective("cabinet", 444, 628, 4, true);
      this.addPerspective("drawer", 756, 95, 4, true);
      this.addFurniture(262, 600, 238, 0.72, 0, false);
    }

    private drawDailyRoom() {
      this.addFurniture(506, 205, 170, 1.25, 0, true);
      this.addPerspective("chair-front", 205, 102, 3.2, false);
      this.addPerspective("chair-side", 285, 170, 3.2, false, true);
      this.addPerspective("chair-front", 205, 238, 3.2, false, true);
      this.addPerspective("chair-side", 125, 170, 3.2, false);
      this.addPerspective("board", 88, 82, 4, true);
      this.addPerspective("plant-small", 330, 255, 3.4, false);
    }

    private drawPlanningRoom() {
      [918, 982, 1046].forEach((x, index) => this.addFurniture(454 + index, x, 170, 1, 0, true));
      this.addPerspective("chair-side", 918, 105, 3.1, false);
      this.addPerspective("chair-side", 1046, 105, 3.1, false, true);
      this.addPerspective("chair-front", 918, 238, 3.1, false);
      this.addPerspective("chair-front", 1046, 238, 3.1, false, true);
      this.addFurniture(158, 966, 164, 0.48, -10, false);
      this.addFurniture(159, 1000, 174, 0.48, 8, false);
      this.addPerspective("bookshelf-left", 1090, 84, 4, true);
      this.addPerspective("bookshelf-middle", 1128, 84, 4, true);
      this.addPerspective("bookshelf-right", 1150, 84, 4, true);
    }

    private drawRetroRoom() {
      this.addPerspective("sofa-left", 120, 535, 4, true);
      this.addPerspective("sofa-middle", 178, 535, 4, true);
      this.addPerspective("sofa-right", 236, 535, 4, true);
      this.addPerspective("sofa-left", 345, 540, 4, true, true);
      this.addFurniture(506, 235, 610, 0.82, 0, true);
      this.addPerspective("bookshelf-left", 110, 445, 4, true);
      this.addPerspective("bookshelf-middle", 150, 445, 4, true);
      this.addPerspective("bookshelf-right", 190, 445, 4, true);
      this.addPerspective("plant-round", 410, 620, 3.5, false);
    }

    private drawCoffeeRoom() {
      (["cabinet", "drawer", "locker"] as const).forEach((asset, index) => this.addPerspective(asset, 805 + index * 58, 454, 4.2, true));
      this.addFurniture(474, 1075, 555, 0.95, 0, true);
      this.addFurniture(475, 1127, 555, 0.95, 0, true);
      this.addFurniture(476, 1060, 625, 0.82, 180, false);
      this.addFurniture(506, 910, 570, 0.9, 0, true);
      this.addFurniture(528, 910, 630, 0.7, 180, false);
      this.addPerspective("plant-small", 830, 585, 3.4, false);
      this.addPerspective("plant-tree", 1130, 445, 3.4, false);
    }

    private addPerspective(asset: (typeof PERSPECTIVE_ASSETS)[number], x: number, y: number, scale: number, collides = true, flipX = false) {
      if (collides) {
        const image = this.physics.add.staticImage(x, y, perspectiveKey(asset)).setScale(scale).setFlipX(flipX).setDepth(y);
        image.refreshBody();
        const body = image.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(image.displayWidth * 0.72, image.displayHeight * 0.5, true);
        this.staticBodies.push(image);
        return image;
      }
      return this.add.image(x, y, perspectiveKey(asset)).setScale(scale).setFlipX(flipX).setDepth(y);
    }

    private drawGadgets() {
      GADGETS.forEach((gadget) => {
        const ring = this.add.ellipse(gadget.x, gadget.y, 78, 52, gadget.color, 0.04)
          .setStrokeStyle(3, gadget.color, 0.9)
          .setDepth(1890);
        this.tweens.add({ targets: ring, scaleX: 1.1, scaleY: 1.1, alpha: 0.35, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

        const badge = this.add.container(gadget.x, gadget.y - 32).setDepth(1904).setSize(78, 24).setInteractive({ useHandCursor: true });
        const background = this.add.rectangle(0, 0, 78, 24, options.dark ? 0x111827 : 0xffffff, 0.96).setStrokeStyle(2, gadget.color);
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

    private addFurniture(id: number, x: number, y: number, scale: number, angle = 0, collides = true) {
      if (collides) {
        const image = this.physics.add.staticImage(x, y, officeKey(id)).setScale(scale).setAngle(angle).setDepth(y);
        image.refreshBody();
        const body = image.body as Phaser.Physics.Arcade.StaticBody;
        body.setSize(image.displayWidth * 0.72, image.displayHeight * 0.66, true);
        this.staticBodies.push(image);
        return image;
      }
      return this.add.image(x, y, officeKey(id)).setScale(scale).setAngle(angle).setDepth(y);
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
      const sprite = this.physics.add.sprite(x, y, avatarKey(participant)).setScale(3.2).setDepth(y);
      sprite.body!.setSize(10, 8).setOffset(3, 8);
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
      return { sprite, shadow, presence, name, status, participant };
    }

    private animatePlayer(time: number, body: Phaser.Physics.Arcade.Body) {
      if (!this.player) return;
      const moving = body.velocity.lengthSq() > 0;
      if (moving) {
        if (Math.abs(body.velocity.x) > 8) this.player.sprite.setFlipX(body.velocity.x < 0);
        this.player.sprite.setAngle(Math.sin(time / 75) * 2.2);
        this.player.sprite.setScale(3.2 + Math.sin(time / 90) * 0.1);
      } else {
        this.player.sprite.setAngle(0);
        this.player.sprite.setScale(3.2);
      }
    }

    private updateAvatarDecorations() {
      for (const avatar of this.avatars.values()) {
        const { x, y } = avatar.sprite;
        avatar.shadow.setPosition(x, y + 18).setDepth(y - 2);
        avatar.presence.setPosition(x, y + 8).setDepth(y - 1);
        avatar.sprite.setDepth(y);
        avatar.name.setPosition(x, y + 35);
        avatar.status.setPosition(x, y + 52);
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
    render: { antialias: false, pixelArt: true, roundPixels: true },
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
