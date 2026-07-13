<script setup lang="ts">
const model = defineModel<boolean>({ required: true });
defineProps<{ title: string; body: string }>();
defineEmits<{ confirm: [] }>();
</script>

<template>
  <UModal v-model="model">
    <UCard>
      <template #header><h2 class="font-semibold">{{ title }}</h2></template>
      <p class="text-gray-600 dark:text-gray-300">{{ body }}</p>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton color="gray" variant="ghost" @click="model = false">Cancelar</UButton>
          <UButton color="red" icon="i-lucide-trash" @click="$emit('confirm'); model = false">Eliminar</UButton>
        </div>
      </template>
    </UCard>
  </UModal>
</template>
