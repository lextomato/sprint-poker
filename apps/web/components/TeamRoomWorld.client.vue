<script setup lang="ts">
import { TeamZone, type ParticipantView } from "@planning/shared";
import type { TeamGadgetId } from "~/game/teamRoomWorld";

const props = defineProps<{
  participants: ParticipantView[];
  currentParticipantId: string;
  dark: boolean;
}>();
const emit = defineEmits<{
  move: [payload: { x: number; y: number; zone: TeamZone }];
  zoneChange: [zone: TeamZone];
  enterZone: [zone: TeamZone];
  gadgetChange: [gadget: TeamGadgetId | null];
  openGadget: [gadget: TeamGadgetId];
  selectMember: [participantId: string];
}>();

const host = ref<HTMLElement | null>(null);
const activeZone = ref<TeamZone>(TeamZone.TEAM_ROOM);
const activeGadget = ref<TeamGadgetId | null>(null);
const loading = ref(true);
let world: { destroy: () => void; syncParticipants: (participants: ParticipantView[]) => void } | null = null;

const zoneActions: Partial<Record<TeamZone, { label: string; icon: string; color: "green" | "cyan" | "amber" | "rose" }>> = {
  [TeamZone.DAILY_ROOM]: { label: "Entrar a Daily", icon: "i-lucide-sunrise", color: "green" },
  [TeamZone.PLANNING_ROOM]: { label: "Abrir Planning", icon: "i-lucide-spade", color: "cyan" },
  [TeamZone.RETROSPECTIVE_ROOM]: { label: "Abrir Retro", icon: "i-lucide-panels-top-left", color: "amber" },
  [TeamZone.COFFEE_AREA]: { label: "Entrar a Coffee", icon: "i-lucide-coffee", color: "rose" }
};
const zoneAction = computed(() => zoneActions[activeZone.value]);
const gadgetActions: Record<TeamGadgetId, { label: string; icon: string; color: "green" | "cyan" | "amber" | "rose" }> = {
  "daily-board": { label: "Ver Daily de hoy", icon: "i-lucide-clipboard-list", color: "green" },
  "planning-table": { label: "Ver sesiones de Planning", icon: "i-lucide-history", color: "cyan" },
  "retro-board": { label: "Ver retrospectivas", icon: "i-lucide-panels-top-left", color: "amber" },
  "coffee-board": { label: "Abrir tablon de notas", icon: "i-lucide-sticky-note", color: "rose" }
};
const gadgetAction = computed(() => activeGadget.value ? gadgetActions[activeGadget.value] : null);

async function mountWorld() {
  if (!host.value) return;
  loading.value = true;
  world?.destroy();
  const { createTeamRoomWorld } = await import("~/game/teamRoomWorld");
  world = createTeamRoomWorld(host.value, {
    participants: props.participants,
    currentParticipantId: props.currentParticipantId,
    dark: props.dark,
    onMove: (x, y, zone) => emit("move", { x, y, zone }),
    onZoneChange: (zone) => {
      activeZone.value = zone;
      emit("zoneChange", zone);
    },
    onEnterZone: (zone) => emit("enterZone", zone),
    onGadgetChange: (gadget) => {
      activeGadget.value = gadget;
      emit("gadgetChange", gadget);
    },
    onOpenGadget: (gadget) => emit("openGadget", gadget),
    onSelectMember: (participantId) => emit("selectMember", participantId),
    onReady: () => { loading.value = false; }
  });
}

onMounted(mountWorld);
onBeforeUnmount(() => world?.destroy());
watch(() => props.participants, (participants) => world?.syncParticipants(participants), { deep: true });
watch(() => props.dark, mountWorld);
</script>

<template>
  <div class="relative min-h-0 overflow-hidden rounded-lg border border-gray-200 bg-slate-100 shadow-sm dark:border-gray-800 dark:bg-gray-900 xl:h-full">
    <div ref="host" class="team-room-canvas aspect-[12/7] w-full xl:h-full xl:min-h-0 xl:aspect-auto" />
    <Transition leave-active-class="transition duration-300" leave-to-class="opacity-0">
      <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-slate-100 dark:bg-gray-900">
        <UIcon name="i-lucide-loader-circle" class="h-7 w-7 animate-spin text-primary-500" />
      </div>
    </Transition>
    <Transition enter-active-class="transition duration-200" enter-from-class="translate-y-3 opacity-0" leave-active-class="transition duration-150" leave-to-class="translate-y-3 opacity-0">
      <UButton
        v-if="gadgetAction && activeGadget"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg"
        size="lg"
        :color="gadgetAction.color"
        :icon="gadgetAction.icon"
        @click="emit('openGadget', activeGadget)"
      >
        {{ gadgetAction.label }}
      </UButton>
      <UButton
        v-else-if="zoneAction"
        class="absolute bottom-4 left-1/2 -translate-x-1/2 shadow-lg"
        size="lg"
        :color="zoneAction.color"
        :icon="zoneAction.icon"
        @click="emit('enterZone', activeZone)"
      >
        {{ zoneAction.label }}
      </UButton>
    </Transition>
  </div>
</template>

<style scoped>
.team-room-canvas :deep(canvas) {
  display: block;
  max-width: 100%;
  touch-action: none;
}

.team-room-canvas :deep(canvas:focus-visible) {
  outline: 2px solid #0d9488;
  outline-offset: -2px;
}
</style>
