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
  snow: "Snow"
};

export const teamAvatarOptions = TEAM_AVATAR_IDS.map((id) => ({
  id,
  label: AVATAR_LABELS[id],
  src: `/game/team-room/avatars-34/${id}.png`
}));

export function teamAvatarImage(id: TeamAvatarId) {
  return `/game/team-room/avatars-34/${id}.png`;
}

export function fallbackTeamAvatar(seed: string): TeamAvatarId {
  let hash = 0;
  for (const character of seed) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return TEAM_AVATAR_IDS[Math.abs(hash) % TEAM_AVATAR_IDS.length]!;
}

export function participantAvatar(avatarId: TeamAvatarId | null | undefined, participantId: string) {
  return avatarId ?? fallbackTeamAvatar(participantId);
}
