<script setup lang="ts">
import { DailyStatus, RoomType, TeamAvailability, TeamZone, type ParticipantView, type TeamAvatarId } from "@planning/shared";
import type { TeamGadgetId } from "~/game/teamRoomWorld";
import { fallbackTeamAvatar, participantAvatar, teamAvatarImage, teamAvatarOptions } from "~/utils/teamAvatars";

const route = useRoute();
const router = useRouter();
const colorMode = useColorMode();
const roomCode = computed(() => String(route.params.roomCode).toUpperCase());
const roomStore = useRoomStore();
const socket = useRoomSocket(roomCode.value);
const team = useTeam(roomCode.value);
const recentRooms = useRecentRooms();
const state = computed(() => roomStore.state);
const recentRoomList = computed(() => recentRooms.rooms.value);
const selectedMember = ref<ParticipantView | null>(null);
const activeGadgetModal = ref<TeamGadgetId | null>(null);
const avatarPickerOpen = ref(false);
const activity = ref("");
const activeZone = ref<TeamZone>(TeamZone.TEAM_ROOM);
const availability = ref<TeamAvailability>(TeamAvailability.AVAILABLE);
const selectedAvatarId = ref<TeamAvatarId>("sage");
const avatarStorageKey = "sprint-poker:team-avatar";
const availabilityOptions = [
  { label: "Disponible", value: TeamAvailability.AVAILABLE, color: "bg-emerald-500" },
  { label: "Concentrado", value: TeamAvailability.FOCUS, color: "bg-blue-500" },
  { label: "Ocupado", value: TeamAvailability.BUSY, color: "bg-orange-500" },
  { label: "Ausente", value: TeamAvailability.AWAY, color: "bg-gray-400" },
  { label: "Descanso", value: TeamAvailability.BREAK, color: "bg-yellow-500" }
];
const zones = [
  { id: TeamZone.DAILY_ROOM, title: "Daily Room", icon: "i-lucide-sunrise" },
  { id: TeamZone.PLANNING_ROOM, title: "Planning Poker", icon: "i-lucide-spade" },
  { id: TeamZone.RETROSPECTIVE_ROOM, title: "Retrospective", icon: "i-lucide-panels-top-left" },
  { id: TeamZone.COFFEE_AREA, title: "Coffee Area", icon: "i-lucide-coffee" }
] as const;

onMounted(async () => {
  recentRooms.load();
  const ok = await socket.sync();
  if (!ok) return router.push(`/join/${roomCode.value}`);
  if (state.value?.me) {
    const me = state.value.me;
    availability.value = me.availability;
    activity.value = me.activity ?? "";
    activeZone.value = me.zone;
    const storedAvatar = localStorage.getItem(avatarStorageKey);
    const preferredAvatar = teamAvatarOptions.some((avatar) => avatar.id === storedAvatar)
      ? storedAvatar as TeamAvatarId
      : fallbackTeamAvatar(me.userId ?? me.id);
    selectedAvatarId.value = me.avatarId ?? preferredAvatar;
    localStorage.setItem(avatarStorageKey, selectedAvatarId.value);
    if (!me.avatarId) await team.updatePresence(me.availability, me.zone, me.activity, selectedAvatarId.value);
  }
});

watch(() => state.value?.room.type, (type) => {
  if (type && type !== RoomType.TEAM) void router.replace(type === RoomType.RETROSPECTIVE ? `/retrospectives/${roomCode.value}` : `/rooms/${roomCode.value}`);
});

watch(() => state.value?.me, (me) => {
  if (!me) return;
  availability.value = me.availability;
  activity.value = me.activity ?? "";
  if (me.avatarId) selectedAvatarId.value = me.avatarId;
}, { deep: true });

function membersIn(zone: TeamZone) {
  return state.value?.participants.filter((participant) => participant.zone === zone && participant.connected) ?? [];
}

function availabilityLabel(member: ParticipantView) {
  return availabilityOptions.find((item) => item.value === member.availability)?.label ?? member.availability;
}

function availabilityColor(member: ParticipantView) {
  return availabilityOptions.find((item) => item.value === member.availability)?.color ?? "bg-gray-400";
}

function zoneStatus(zone: TeamZone) {
  if (zone === TeamZone.DAILY_ROOM && state.value?.daily?.status === DailyStatus.ACTIVE) return "En curso";
  const count = membersIn(zone).length;
  return count ? `${count} presente${count === 1 ? "" : "s"}` : "Disponible";
}

function selectMember(participantId: string) {
  selectedMember.value = state.value?.participants.find((participant) => participant.id === participantId) ?? null;
}

async function saveStatus() {
  await team.updatePresence(availability.value, activeZone.value, activity.value || null, selectedAvatarId.value);
}

async function selectAvatar(avatarId: TeamAvatarId) {
  selectedAvatarId.value = avatarId;
  localStorage.setItem(avatarStorageKey, avatarId);
  await saveStatus();
  avatarPickerOpen.value = false;
}

function moveAvatar(payload: { x: number; y: number; zone: TeamZone }) {
  activeZone.value = payload.zone;
  team.updatePosition(payload.x, payload.y, payload.zone);
}

async function enterZone(zone: TeamZone) {
  activeZone.value = zone;
  if (zone === TeamZone.COFFEE_AREA) availability.value = TeamAvailability.BREAK;
  await team.updatePresence(availability.value, zone, activity.value || null, selectedAvatarId.value);
  if (zone === TeamZone.DAILY_ROOM) await router.push(`/teams/${roomCode.value}/daily`);
  if (zone === TeamZone.PLANNING_ROOM) await router.push("/planning");
  if (zone === TeamZone.RETROSPECTIVE_ROOM) await router.push("/retrospectives");
}
</script>

<template>
  <NuxtPage v-if="route.path.endsWith('/daily')" />
  <main v-else class="min-h-screen bg-gray-100 p-3 text-gray-950 dark:bg-gray-950 dark:text-white sm:p-4 xl:flex xl:h-dvh xl:flex-col xl:overflow-hidden">
    <template v-if="state?.team && state.me">
      <header class="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 dark:border-gray-800 dark:bg-gray-900">
        <div class="flex min-w-0 items-center gap-3">
          <AppLogo compact />
          <div class="min-w-0">
            <h1 class="truncate font-semibold">{{ state.room.name }}</h1>
            <p class="text-xs text-gray-500">Virtual Team Room · {{ state.room.code }}</p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <UBadge color="green" variant="soft"><span class="mr-1.5 h-2 w-2 rounded-full bg-emerald-500" />{{ state.participants.filter(p => p.connected).length }} online</UBadge>
          <UButton to="/" icon="i-lucide-home" color="gray" variant="ghost">Inicio</UButton>
          <ConnectionStatus />
          <ThemeToggle />
        </div>
      </header>

      <section class="mb-3 flex shrink-0 flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-white p-2.5 dark:border-gray-800 dark:bg-gray-900">
        <button
          class="flex h-10 items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-2.5 text-sm font-medium transition hover:border-cyan-400 hover:bg-cyan-50 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-cyan-600 dark:hover:bg-cyan-950"
          type="button"
          @click="avatarPickerOpen = true"
        >
          <img :src="teamAvatarImage(selectedAvatarId)" alt="" class="pixel-avatar h-8 w-8 object-contain" />
          <span>Avatar</span>
          <UIcon name="i-lucide-pencil" class="h-3.5 w-3.5 text-gray-400" />
        </button>
        <div class="flex items-center gap-2 px-2 text-sm font-medium">
          <span class="h-2.5 w-2.5 rounded-full" :class="availabilityOptions.find(item => item.value === availability)?.color" />
          Mi estado
        </div>
        <USelectMenu v-model="availability" class="w-40" :options="availabilityOptions" value-attribute="value" option-attribute="label" @change="saveStatus" />
        <UInput v-model="activity" class="min-w-52 flex-1" placeholder="¿En qué estás trabajando?" maxlength="80" @keyup.enter="saveStatus" />
        <UButton icon="i-lucide-check" color="cyan" aria-label="Guardar estado" @click="saveStatus" />
      </section>

      <section class="grid min-h-0 gap-3 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_300px]">
        <TeamRoomWorld
          :participants="state.participants"
          :current-participant-id="state.me.id"
          :dark="colorMode.value === 'dark'"
          @move="moveAvatar"
          @zone-change="activeZone = $event"
          @enter-zone="enterZone"
          @open-gadget="activeGadgetModal = $event"
          @select-member="selectMember"
        />

        <aside class="grid content-start gap-3 sm:grid-cols-2 xl:h-full xl:grid-cols-1 xl:overflow-y-auto xl:pr-1">
          <section class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <div class="mb-2 flex items-center justify-between">
              <h2 class="text-sm font-semibold">Espacios</h2>
              <UIcon name="i-lucide-map" class="h-4 w-4 text-gray-400" />
            </div>
            <button
              v-for="zone in zones"
              :key="zone.id"
              class="flex w-full items-center gap-3 border-t border-gray-100 py-2.5 text-left first:border-t-0 dark:border-gray-800"
              @click="enterZone(zone.id)"
            >
              <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800"><UIcon :name="zone.icon" class="h-4 w-4" /></span>
              <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">{{ zone.title }}</span><span class="block text-xs text-gray-500">{{ zoneStatus(zone.id) }}</span></span>
              <UIcon name="i-lucide-chevron-right" class="h-4 w-4 text-gray-400" />
            </button>
          </section>

          <section class="rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <div class="mb-2 flex items-center justify-between">
              <h2 class="text-sm font-semibold">Equipo</h2>
              <UBadge color="gray" variant="soft">{{ state.participants.length }}</UBadge>
            </div>
            <button
              v-for="member in state.participants"
              :key="member.id"
              class="flex w-full items-center gap-3 border-t border-gray-100 py-2.5 text-left first:border-t-0 dark:border-gray-800"
              @click="selectedMember = member"
            >
              <span class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-950">
                <img :src="teamAvatarImage(participantAvatar(member.avatarId, member.id))" alt="" class="pixel-avatar h-9 w-9 object-contain" />
                <span class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900" :class="member.connected ? availabilityColor(member) : 'bg-gray-400'" />
              </span>
              <span class="min-w-0 flex-1"><span class="block truncate text-sm font-medium">{{ member.displayName }}</span><span class="block truncate text-xs text-gray-500">{{ member.activity || availabilityLabel(member) }}</span></span>
            </button>
          </section>
        </aside>
      </section>

      <UModal :model-value="Boolean(selectedMember)" @update:model-value="selectedMember = null">
        <UCard v-if="selectedMember">
          <template #header>
            <div class="flex items-center gap-3">
              <span class="flex h-12 w-12 items-center justify-center rounded-md bg-cyan-50 dark:bg-cyan-950"><img :src="teamAvatarImage(participantAvatar(selectedMember.avatarId, selectedMember.id))" alt="" class="pixel-avatar h-11 w-11 object-contain" /></span>
              <div><h2 class="font-semibold">{{ selectedMember.displayName }}</h2><p class="text-sm text-gray-500">{{ availabilityLabel(selectedMember) }}</p></div>
            </div>
          </template>
          <dl class="grid grid-cols-2 gap-4 text-sm">
            <div><dt class="text-gray-500">Actividad actual</dt><dd class="font-medium">{{ selectedMember.activity || 'Sin indicar' }}</dd></div>
            <div><dt class="text-gray-500">Espacio</dt><dd class="font-medium">{{ zones.find(zone => zone.id === selectedMember?.zone)?.title || 'Team Workspace' }}</dd></div>
            <div><dt class="text-gray-500">Blockers abiertos</dt><dd class="font-medium">{{ state.team.sessions.flatMap(s => s.blockers).filter(b => b.participantId === selectedMember?.id && !b.resolvedAt).length }}</dd></div>
            <div><dt class="text-gray-500">Conexión</dt><dd class="font-medium">{{ selectedMember.connected ? 'Online' : 'Offline' }}</dd></div>
          </dl>
        </UCard>
      </UModal>

      <UModal v-model="avatarPickerOpen">
        <UCard>
          <template #header>
            <div>
              <h2 class="font-semibold">Elige tu avatar</h2>
              <p class="mt-1 text-sm text-gray-500">Tu eleccion se guarda y todos la veran en la sala.</p>
            </div>
          </template>
          <div class="grid grid-cols-4 gap-2 sm:grid-cols-7">
            <button
              v-for="avatar in teamAvatarOptions"
              :key="avatar.id"
              type="button"
              class="group relative flex min-w-0 flex-col items-center gap-1 rounded-md border p-2 transition hover:border-cyan-400 hover:bg-cyan-50 dark:hover:border-cyan-600 dark:hover:bg-cyan-950"
              :class="selectedAvatarId === avatar.id ? 'border-cyan-500 bg-cyan-50 ring-2 ring-cyan-500/20 dark:bg-cyan-950' : 'border-gray-200 dark:border-gray-700'"
              :aria-pressed="selectedAvatarId === avatar.id"
              @click="selectAvatar(avatar.id)"
            >
              <img :src="avatar.src" :alt="avatar.label" class="pixel-avatar h-14 w-14 object-contain transition group-hover:-translate-y-0.5" />
              <span class="w-full truncate text-center text-xs font-medium">{{ avatar.label }}</span>
              <UIcon v-if="selectedAvatarId === avatar.id" name="i-lucide-circle-check" class="absolute right-1 top-1 h-4 w-4 text-cyan-600" />
            </button>
          </div>
        </UCard>
      </UModal>

      <TeamGadgetModals
        v-model="activeGadgetModal"
        :room-code="roomCode"
        :state="state"
        :recent-rooms="recentRoomList"
      />
    </template>
    <div v-else class="flex min-h-[70vh] items-center justify-center"><UIcon name="i-lucide-loader-circle" class="h-8 w-8 animate-spin text-cyan-500" /></div>
  </main>
</template>

<style scoped>
.pixel-avatar {
  image-rendering: pixelated;
}
</style>
