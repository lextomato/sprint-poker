<script setup lang="ts">
const auth = useAuth();
onMounted(() => auth.load());
</script>

<template>
  <UDropdown v-if="auth.user.value" :items="[[{ label: auth.user.value.email, disabled: true }], [{ label: 'Cerrar sesion', icon: 'i-lucide-log-out', click: auth.logout }]]">
    <UButton color="gray" variant="ghost" icon="i-lucide-circle-user-round">{{ auth.user.value.displayName }}</UButton>
  </UDropdown>
  <UButton v-else to="/account" color="gray" variant="ghost" icon="i-lucide-log-in">Acceder</UButton>
</template>
