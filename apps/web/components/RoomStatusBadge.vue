<script setup lang="ts">
import type { RoomStatus } from "@planning/shared";

const props = defineProps<{ status: RoomStatus }>();

const color = computed(() => {
  if (props.status === "VOTING") return "blue";
  if (props.status === "REVEALED") return "green";
  if (props.status === "CLOSED") return "red";
  return "gray";
});
</script>

<template>
  <UBadge :color="color" variant="subtle">{{ status }}</UBadge>
</template>
