<script setup lang="ts">
import type { StoryView } from "@planning/shared";

const model = defineModel<boolean>({ required: true });
const props = defineProps<{ story?: StoryView | null }>();
const emit = defineEmits<{ save: [{ title: string; description?: string; acceptanceCriteria?: string }] }>();

const form = reactive({ title: "", description: "", acceptanceCriteria: "" });
watch(
  () => props.story,
  (story) => {
    form.title = story?.title ?? "";
    form.description = story?.description ?? "";
    form.acceptanceCriteria = story?.acceptanceCriteria ?? "";
  },
  { immediate: true }
);

function save() {
  emit("save", { ...form });
  model.value = false;
}
</script>

<template>
  <UModal v-model="model">
    <UCard>
      <template #header>
        <h2 class="font-semibold">{{ story ? "Editar historia" : "Nueva historia" }}</h2>
      </template>
      <UForm :state="form" class="space-y-4" @submit="save">
        <UFormGroup label="Titulo" name="title" required>
          <UInput v-model="form.title" maxlength="200" />
        </UFormGroup>
        <UFormGroup label="Descripcion" name="description">
          <UTextarea v-model="form.description" :rows="4" maxlength="5000" />
        </UFormGroup>
        <UFormGroup label="Criterios de aceptacion" name="acceptanceCriteria">
          <UTextarea v-model="form.acceptanceCriteria" :rows="4" maxlength="5000" />
        </UFormGroup>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="model = false">Cancelar</UButton>
          <UButton type="submit" icon="i-lucide-save" color="teal">Guardar</UButton>
        </div>
      </UForm>
    </UCard>
  </UModal>
</template>
