<script setup lang="ts">
import { RoomType } from "@planning/shared";
import type { RecentRoom } from "~/composables/useRecentRooms";

const router = useRouter();
const recentRooms = useRecentRooms();
const rooms = computed(() => recentRooms.rooms.value);

onMounted(() => recentRooms.load());

function roomDestination(room: RecentRoom) {
  const base = room.type === RoomType.TEAM ? "/teams" : room.type === RoomType.RETROSPECTIVE ? "/retrospectives" : "/rooms";
  return recentRooms.hasSession(room.code) ? `${base}/${room.code}` : `/join/${room.code}`;
}
</script>

<template>
  <main class="page-shell min-h-screen px-4 py-8 sm:px-6">
    <div class="mx-auto w-full max-w-6xl">
      <header class="flex items-center justify-between">
        <AppLogo />
        <div class="flex items-center gap-1"><AccountMenu /><ThemeToggle /></div>
      </header>
      <section class="py-12 text-center sm:py-16">
        <h1 class="mx-auto max-w-3xl text-4xl font-bold text-gray-950 dark:text-white sm:text-5xl">Una sala para cada conversación del sprint</h1>
        <p class="mx-auto mt-4 max-w-2xl text-lg text-gray-600 dark:text-gray-300">Elige cómo quiere trabajar el equipo. Sin registro, con colaboración en tiempo real.</p>
      </section>
      <section class="grid gap-4 md:grid-cols-3">
        <NuxtLink to="/teams" class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-400 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-cyan-600">
          <div class="flex items-start justify-between gap-6">
            <div>
              <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-100 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300"><UIcon name="i-lucide-layout-dashboard" class="h-6 w-6" /></div>
              <h2 class="text-xl font-semibold text-gray-950 dark:text-white">Team Room</h2>
              <p class="mt-2 text-gray-600 dark:text-gray-300">Presencia, Daily Standup y acceso visual a todas las ceremonias.</p>
            </div>
            <UIcon name="i-lucide-arrow-right" class="mt-2 h-5 w-5 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-cyan-600" />
          </div>
        </NuxtLink>
        <NuxtLink to="/planning" class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-teal-600">
          <div class="flex items-start justify-between gap-6">
            <div>
              <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-teal-100 text-teal-700 dark:bg-teal-950 dark:text-teal-300"><UIcon name="i-lucide-spade" class="h-6 w-6" /></div>
              <h2 class="text-xl font-semibold text-gray-950 dark:text-white">Planning Poker</h2>
              <p class="mt-2 text-gray-600 dark:text-gray-300">Estima historias, revela votos y acuerda el esfuerzo del próximo sprint.</p>
            </div>
            <UIcon name="i-lucide-arrow-right" class="mt-2 h-5 w-5 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-teal-600" />
          </div>
        </NuxtLink>
        <NuxtLink to="/retrospectives" class="group rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-gray-800 dark:bg-gray-900 dark:hover:border-amber-600">
          <div class="flex items-start justify-between gap-6">
            <div>
              <div class="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"><UIcon name="i-lucide-panels-top-left" class="h-6 w-6" /></div>
              <h2 class="text-xl font-semibold text-gray-950 dark:text-white">Retrospectiva</h2>
              <p class="mt-2 text-gray-600 dark:text-gray-300">Recoge ideas, prioriza con votos y convierte la conversación en acciones.</p>
            </div>
            <UIcon name="i-lucide-arrow-right" class="mt-2 h-5 w-5 shrink-0 text-gray-400 transition group-hover:translate-x-1 group-hover:text-amber-600" />
          </div>
        </NuxtLink>
      </section>
      <section v-if="rooms.length" class="mt-10">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-gray-500">Salas recientes</h2>
          <span class="text-xs text-gray-400">Guardadas en este navegador</span>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button v-for="room in rooms" :key="room.code" class="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white/90 p-3 text-left shadow-sm hover:border-teal-300 dark:border-gray-800 dark:bg-gray-900/80" @click="router.push(roomDestination(room))">
            <div class="min-w-0">
              <p class="truncate font-medium text-gray-950 dark:text-white">{{ room.name }}</p>
              <div class="mt-1 flex items-center gap-2 text-xs text-gray-500">
                <UIcon :name="room.type === RoomType.TEAM ? 'i-lucide-layout-dashboard' : room.type === RoomType.RETROSPECTIVE ? 'i-lucide-panels-top-left' : 'i-lucide-spade'" class="h-3.5 w-3.5" />
                <span>{{ room.code }}</span>
                <RoomStatusBadge :status="room.status" />
              </div>
            </div>
            <UIcon :name="recentRooms.hasSession(room.code) ? 'i-lucide-rotate-ccw' : 'i-lucide-log-in'" class="h-4 w-4 shrink-0 text-teal-600" />
          </button>
        </div>
      </section>
    </div>
  </main>
</template>
