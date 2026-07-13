<script setup lang="ts">
import { ClientEvents, type RoomCrashEvent } from "@planning/shared";

const crashed = ref(false);
const countdown = ref<number | null>(null);
const route = useRoute();
const countdownTimers: number[] = [];
const crashListener = (event: Event) => runCrashEvent((event as CustomEvent<RoomCrashEvent>).detail);

const roomCode = computed(() => {
  const value = route.params.roomCode;
  return route.path.startsWith("/rooms/") && typeof value === "string" ? value.toUpperCase() : null;
});

function randomBetween(min: number, max: number) {
  return Math.round(min + Math.random() * (max - min));
}

function clearTimers() {
  while (countdownTimers.length) {
    window.clearTimeout(countdownTimers.pop());
  }
}

function primeExplosion() {
  const elements = document.querySelectorAll<HTMLElement>(".crash-stage :is(header, aside, section, .rounded-lg, .rounded-md, .rounded-xl, .app-grid > div)");
  elements.forEach((element, index) => {
    const direction = index % 2 === 0 ? -1 : 1;
    const x = direction * randomBetween(4, 36);
    const y = randomBetween(12, 58);
    const rotation = direction * randomBetween(5, 24);
    const delay = randomBetween(0, 130);
    element.style.setProperty("--crash-x", `${x}vw`);
    element.style.setProperty("--crash-y", `${y}vh`);
    element.style.setProperty("--crash-r", `${rotation}deg`);
    element.style.setProperty("--crash-delay", `${delay}ms`);
  });

  const looseParts = document.querySelectorAll<HTMLElement>(".crash-stage :is(button, input, textarea, select, a, img)");
  looseParts.forEach((element, index) => {
    const direction = index % 3 === 0 ? -1 : 1;
    element.style.setProperty("--crash-part-x", `${direction * randomBetween(2, 14)}vw`);
    element.style.setProperty("--crash-part-y", `${randomBetween(5, 26)}vh`);
    element.style.setProperty("--crash-part-r", `${direction * randomBetween(8, 32)}deg`);
  });
}

function clearExplosionVars() {
  const elements = document.querySelectorAll<HTMLElement>(".crash-stage *");
  elements.forEach((element) => {
    element.style.removeProperty("--crash-x");
    element.style.removeProperty("--crash-y");
    element.style.removeProperty("--crash-r");
    element.style.removeProperty("--crash-delay");
    element.style.removeProperty("--crash-part-x");
    element.style.removeProperty("--crash-part-y");
    element.style.removeProperty("--crash-part-r");
  });
}

function applyState(next: boolean) {
  if (next) {
    primeExplosion();
    playExplosionSound();
  }
  crashed.value = next;
  document.documentElement.classList.toggle("crash-mode", next);
  document.documentElement.classList.toggle("crash-recovering", false);
}

function restore() {
  clearTimers();
  countdown.value = null;
  crashed.value = false;
  document.documentElement.classList.remove("crash-mode");
  document.documentElement.classList.add("crash-recovering");
  window.setTimeout(() => {
    document.documentElement.classList.remove("crash-recovering");
    clearExplosionVars();
  }, 900);
}

function audioContextConstructor() {
  return window.AudioContext ?? (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
}

function playTone(frequency: number, duration: number, type: OscillatorType = "sine", gain = 0.055) {
  const AudioContextClass = audioContextConstructor();
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const oscillator = context.createOscillator();
  const volume = context.createGain();
  oscillator.type = type;
  oscillator.frequency.value = frequency;
  volume.gain.setValueAtTime(gain, context.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + duration);
  oscillator.connect(volume);
  volume.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + duration);
  window.setTimeout(() => context.close(), Math.ceil(duration * 1000) + 80);
}

function playCountdownSound(step: number) {
  playTone(step === 1 ? 660 : 440, 0.11, "triangle", 0.045);
}

function playExplosionSound() {
  const AudioContextClass = audioContextConstructor();
  if (!AudioContextClass) return;
  const context = new AudioContextClass();
  const bufferSize = context.sampleRate * 0.55;
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < bufferSize; index += 1) {
    const decay = 1 - index / bufferSize;
    data[index] = (Math.random() * 2 - 1) * decay * decay;
  }
  const noise = context.createBufferSource();
  const filter = context.createBiquadFilter();
  const volume = context.createGain();
  noise.buffer = buffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(980, context.currentTime);
  filter.frequency.exponentialRampToValueAtTime(120, context.currentTime + 0.52);
  volume.gain.setValueAtTime(0.18, context.currentTime);
  volume.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.55);
  noise.connect(filter);
  filter.connect(volume);
  volume.connect(context.destination);
  noise.start();
  noise.stop(context.currentTime + 0.55);
  window.setTimeout(() => context.close(), 720);
}

function runCrashEvent(event: RoomCrashEvent) {
  clearTimers();
  if (event.action === "back") {
    restore();
    return;
  }
  const delay = Math.max(0, event.startsAt - Date.now());
  const steps = [3, 2, 1];
  steps.forEach((step, index) => {
    countdownTimers.push(
      window.setTimeout(() => {
        countdown.value = step;
        playCountdownSound(step);
      }, delay + index * 720)
    );
  });
  countdownTimers.push(
    window.setTimeout(() => {
      countdown.value = null;
      applyState(true);
    }, delay + steps.length * 720)
  );
}

async function broadcastOrRun(action: "boom" | "back") {
  const code = roomCode.value;
  const token = code ? useParticipantSession(code).getToken() : null;
  if (code && token) {
    const socket = useRoomSocket(code);
    const response = await socket.emit(ClientEvents.ROOM_CRASH, { roomCode: code, sessionToken: token, action });
    if (response.ok) return;
  }
  runCrashEvent({ action, startsAt: Date.now() + 150, countdown: action === "boom" ? 3 : 0 });
}

async function activate() {
  const keyword = window.prompt(crashed.value ? "Clave de restauracion" : "Clave");
  if (keyword === "BOOM!" && !crashed.value) {
    await broadcastOrRun("boom");
    return;
  }
  if (keyword === "BACK" && crashed.value) {
    await broadcastOrRun("back");
  }
}

onMounted(() => {
  document.documentElement.classList.remove("crash-mode", "crash-recovering");
  clearExplosionVars();
  window.addEventListener("planning-room-crash", crashListener);
});

onBeforeUnmount(() => {
  clearTimers();
  window.removeEventListener("planning-room-crash", crashListener);
  document.documentElement.classList.remove("crash-mode", "crash-recovering");
  clearExplosionVars();
});
</script>

<template>
  <button class="crash-button" type="button" :aria-label="crashed ? 'Restaurar pantalla' : 'Control oculto'" @click="activate">
    <span class="sr-only">{{ crashed ? "Restaurar" : "Control" }}</span>
  </button>
  <div class="crash-blast" aria-hidden="true" />
  <div v-if="countdown" class="crash-countdown" aria-live="assertive">
    {{ countdown }}
  </div>
</template>
