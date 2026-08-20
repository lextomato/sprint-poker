<script setup lang="ts">
const auth = useAuth();
const router = useRouter();
const { showApiError } = useApiErrors();
const mode = ref<"login" | "register">("login");
const loading = ref(false);
const form = reactive({ email: "", password: "", displayName: "" });

onMounted(async () => {
  if (await auth.load()) await router.replace("/");
});

async function submit() {
  loading.value = true;
  try {
    if (mode.value === "register") await auth.register(form);
    else await auth.login({ email: form.email, password: form.password });
    await router.push("/");
  } catch (error) {
    showApiError(error, mode.value === "register" ? "No se pudo crear la cuenta" : "No se pudo iniciar sesion");
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="page-shell flex min-h-screen items-center justify-center px-4 py-8">
    <div class="fixed left-4 top-4"><UButton to="/" icon="i-lucide-arrow-left" color="gray" variant="ghost">Inicio</UButton></div>
    <div class="fixed right-4 top-4"><ThemeToggle /></div>
    <UCard class="w-full max-w-md">
      <template #header>
        <div>
          <h1 class="text-xl font-semibold">{{ mode === 'login' ? 'Tu cuenta' : 'Crear cuenta' }}</h1>
          <p class="mt-1 text-sm text-gray-500">Recupera equipos e historial desde cualquier dispositivo.</p>
        </div>
      </template>
      <div class="space-y-4">
        <div class="grid grid-cols-2 rounded-md bg-gray-100 p-1 dark:bg-gray-800">
          <button class="rounded px-3 py-2 text-sm font-medium" :class="mode === 'login' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'" @click="mode = 'login'">Acceder</button>
          <button class="rounded px-3 py-2 text-sm font-medium" :class="mode === 'register' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'" @click="mode = 'register'">Registrarme</button>
        </div>
        <UForm :state="form" class="space-y-4" @submit="submit">
          <UFormGroup v-if="mode === 'register'" label="Nombre visible" required><UInput v-model="form.displayName" minlength="2" maxlength="40" autocomplete="name" /></UFormGroup>
          <UFormGroup label="Correo" required><UInput v-model="form.email" type="email" maxlength="254" autocomplete="email" /></UFormGroup>
          <UFormGroup label="Contrasena" required><UInput v-model="form.password" type="password" minlength="8" maxlength="128" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" /></UFormGroup>
          <UButton type="submit" block color="teal" icon="i-lucide-arrow-right" :loading="loading">{{ mode === 'login' ? 'Entrar' : 'Crear cuenta' }}</UButton>
        </UForm>
        <p class="text-center text-xs text-gray-500">La cuenta es opcional. Las salas abiertas siguen funcionando sin registro.</p>
      </div>
    </UCard>
  </main>
</template>
