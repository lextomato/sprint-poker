import { TEAM_AVATAR_IDS, type TeamAvatarId } from "@planning/shared";

const AVATAR_LABELS: Record<TeamAvatarId, string> = {
  sage: "Sage",
  marina: "Marina",
  ember: "Ember",
  teal: "Teal",
  pearl: "Pearl",
  coral: "Coral",
  copper: "Copper",
  lilac: "Lilac",
  auburn: "Auburn",
  moss: "Moss",
  aqua: "Aqua",
  amber: "Amber",
  cloud: "Cloud",
  snow: "Snow",
  curly: "Rizos teal",
  "coral-overshirt": "Camisa coral",
  mustard: "Blusa mostaza",
  cream: "Sudadera crema"
};

export const TEAM_AVATAR_DIRECTIONS = [
  "front",
  "front-quarter-right",
  "profile-right",
  "back-quarter-right",
  "back",
  "back-quarter-left",
  "profile-left",
  "front-quarter-left"
] as const;

export type TeamAvatarDirection = (typeof TEAM_AVATAR_DIRECTIONS)[number];
export type DirectionalTeamAvatarId = Extract<TeamAvatarId, "curly" | "coral-overshirt" | "mustard" | "cream">;

const DIRECTION_TEXTURES: Record<TeamAvatarDirection, string> = {
  front: "01-front",
  "front-quarter-right": "02-front-quarter-right",
  "profile-right": "03-profile-right",
  "back-quarter-right": "04-back-quarter-right",
  back: "05-back",
  "back-quarter-left": "06-back-quarter-left",
  "profile-left": "07-profile-left",
  "front-quarter-left": "08-front-quarter-left"
};

const DIRECTIONAL_ASSET_FACING: Record<TeamAvatarDirection, TeamAvatarDirection> = {
  front: "front",
  "front-quarter-right": "front-quarter-left",
  "profile-right": "profile-left",
  "back-quarter-right": "back-quarter-left",
  back: "back",
  "back-quarter-left": "back-quarter-right",
  "profile-left": "profile-right",
  "front-quarter-left": "front-quarter-right"
};

export function isDirectionalTeamAvatar(id: TeamAvatarId | null | undefined): id is DirectionalTeamAvatarId {
  return id === "curly" || id === "coral-overshirt" || id === "mustard" || id === "cream";
}

export function teamAvatarDirectionImage(id: DirectionalTeamAvatarId, direction: TeamAvatarDirection) {
  const file = DIRECTION_TEXTURES[DIRECTIONAL_ASSET_FACING[direction]];
  return `/game/team-room/avatars-directional/${id}/${file}.png`;
}

export function teamAvatarFacingForVector(dx: number, dy: number): TeamAvatarDirection | null {
  if (Math.hypot(dx, dy) < 0.01) return null;
  const sector = (Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) + 8) % 8;
  return [
    "profile-right",
    "front-quarter-right",
    "front",
    "front-quarter-left",
    "profile-left",
    "back-quarter-left",
    "back",
    "back-quarter-right"
  ][sector] as TeamAvatarDirection;
}

export const teamAvatarOptions = TEAM_AVATAR_IDS.map((id) => ({
  id,
  label: AVATAR_LABELS[id],
  src: teamAvatarImage(id)
}));

export function teamAvatarImage(id: TeamAvatarId) {
  return isDirectionalTeamAvatar(id)
    ? teamAvatarDirectionImage(id, "front")
    : `/game/team-room/avatars-34/${id}.png`;
}

export function fallbackTeamAvatar(seed: string): TeamAvatarId {
  let hash = 0;
  for (const character of seed) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return TEAM_AVATAR_IDS[Math.abs(hash) % TEAM_AVATAR_IDS.length]!;
}

export function participantAvatar(avatarId: TeamAvatarId | null | undefined, participantId: string) {
  return avatarId ?? fallbackTeamAvatar(participantId);
}
