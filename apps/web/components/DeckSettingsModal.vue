<script setup lang="ts">
import { planningDeckPresets } from "~/composables/useDeckPreferences";

const model = defineModel<boolean>({ required: true });
const props = defineProps<{ deck: string[] }>();
const emit = defineEmits<{ save: [string[]] }>();
const draft = ref<string[]>([]);
const newValue = ref("");
const selectedPreset = ref<string | undefined>();

watch(model, (open) => {
  if (!open) return;
  draft.value = [...props.deck];
  selectedPreset.value = undefined;
  newValue.value = "";
});

function addValue() {
  const value = newValue.value.trim();
  if (!value || value.length > 16 || draft.value.includes(value) || draft.value.length >= 30) return;
  draft.value.push(value);
  newValue.value = "";
}

function applyPreset(label: string) {
  const preset = planningDeckPresets.find((item) => item.label === label);
  if (preset) draft.value = [...preset.values];
}

function move(index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= draft.value.length) return;
  const next = [...draft.value];
  [next[index], next[target]] = [next[target], next[index]];
  draft.value = next;
}

function save() {
  if (!draft.value.length) return;
  emit("save", draft.value);
  model.value = false;
}
</script>

<template>
  <UModal v-model="model" :ui="{ width: 'w-full sm:max-w-2xl' }">
    <UCard class="flex max-h-[88vh] flex-col" :ui="{ body: { base: 'flex-1 overflow-y-auto' } }">
      <template #header>
        <div>
          <h2 class="font-semibold text-gray-950 dark:text-white">Configurar baraja</h2>
          <p class="mt-1 text-sm text-gray-500">La selección se guarda en este navegador y se reutiliza en tus salas.</p>
        </div>
      </template>

      <div class="space-y-5">
        <UFormGroup label="Usar un preset">
          <USelectMenu v-model="selectedPreset" :options="planningDeckPresets" value-attribute="label" option-attribute="label" placeholder="Seleccionar baraja" @update:model-value="applyPreset" />
        </UFormGroup>

        <div>
          <div class="mb-2 flex items-center justify-between">
            <p class="text-sm font-medium text-gray-700 dark:text-gray-200">Valores</p>
            <span class="text-xs text-gray-500">{{ draft.length }}/30 cartas</span>
          </div>
          <div class="space-y-2">
            <div v-for="(value, index) in draft" :key="`${value}-${index}`" class="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 p-2 dark:border-gray-700 dark:bg-gray-900">
              <span class="flex h-9 w-12 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white">{{ value }}</span>
              <span class="min-w-0 flex-1 truncate text-sm text-gray-500">Carta {{ index + 1 }}</span>
              <UButton icon="i-lucide-arrow-up" color="gray" variant="ghost" size="xs" :disabled="index === 0" aria-label="Mover arriba" @click="move(index, -1)" />
              <UButton icon="i-lucide-arrow-down" color="gray" variant="ghost" size="xs" :disabled="index === draft.length - 1" aria-label="Mover abajo" @click="move(index, 1)" />
              <UButton icon="i-lucide-trash-2" color="red" variant="ghost" size="xs" aria-label="Eliminar carta" @click="draft.splice(index, 1)" />
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <UInput v-model="newValue" class="min-w-0 flex-1" maxlength="16" placeholder="Nuevo valor, por ejemplo 21" @keyup.enter="addValue" />
          <UButton icon="i-lucide-plus" color="teal" variant="soft" :disabled="!newValue.trim() || draft.includes(newValue.trim()) || draft.length >= 30" @click="addValue">Añadir</UButton>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="model = false">Cancelar</UButton>
          <UButton icon="i-lucide-save" color="teal" :disabled="!draft.length" @click="save">Guardar baraja</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
