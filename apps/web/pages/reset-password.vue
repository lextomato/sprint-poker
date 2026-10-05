<script setup lang="ts">
const config = useRuntimeConfig();
const { showApiError } = useApiErrors();
const token = ref("");
const password = ref("");
const confirmPassword = ref("");
const loading = ref(false);
const complete = ref(false);

onMounted(() => {
  token.value = window.location.hash.slice(1);
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
});

async function submit() {
  if (password.value !== confirmPassword.value) {
    showApiError(new Error("Las contrasenas no coinciden."));
    return;
  }
  loading.value = true;
  try {
    await $fetch("/auth/reset-password", {
      baseURL: config.public.apiBaseUrl,
      method: "POST",
      body: { token: token.value, password: password.value }
    });
    complete.value = true;
  } catch (error) {
    showApiError(error, "No se pudo cambiar la contrasena");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="page-shell flex min-h-screen items-center justify-center px-4 py-8">
    <div class="fixed left-4 top-4"><UButton to="/account" icon="i-lucide-arrow-left" color="gray" variant="ghost">Acceder</UButton></div>
    <div class="fixed right-4 top-4"><ThemeToggle /></div>
    <UCard class="w-full max-w-md">
      <template #header>
        <div>
          <h1 class="text-xl font-semibold">{{ complete ? "Contrasena actualizada" : "Elige una nueva contrasena" }}</h1>
          <p class="mt-1 text-sm text-gray-500">{{ complete ? "Tu acceso se restablecio correctamente." : "El enlace solo puede utilizarse una vez y vence en 30 minutos." }}</p>
        </div>
      </template>
      <div v-if="complete" class="space-y-4">
        <p role="status" class="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-100">Ya puedes iniciar sesion con tu nueva contrasena.</p>
        <UButton to="/account" block color="teal" icon="i-lucide-log-in">Iniciar sesion</UButton>
      </div>
      <UForm v-else :state="{ password, confirmPassword }" class="space-y-4" @submit="submit">
        <UFormGroup label="Nueva contrasena" required>
          <UInput v-model="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" />
        </UFormGroup>
        <UFormGroup label="Repite la contrasena" required>
          <UInput v-model="confirmPassword" type="password" minlength="8" maxlength="128" autocomplete="new-password" />
        </UFormGroup>
        <p v-if="!token" class="text-sm text-red-600 dark:text-red-400">Falta el token. Solicita un nuevo enlace de recuperacion.</p>
        <UButton type="submit" block color="teal" icon="i-lucide-key-round" :loading="loading" :disabled="!token">Guardar contrasena</UButton>
      </UForm>
    </UCard>
  </main>
</template>
