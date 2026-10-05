<script setup lang="ts">
const auth = useAuth();
const config = useRuntimeConfig();
const router = useRouter();
const { showApiError } = useApiErrors();
const mode = ref<"login" | "register" | "forgot">("login");
const loading = ref(false);
const successMessage = ref("");
const form = reactive({ email: "", password: "", displayName: "" });

onMounted(async () => {
  if (await auth.load()) await router.replace("/");
});

async function submit() {
  loading.value = true;
  successMessage.value = "";
  try {
    if (mode.value === "forgot") {
      const result = await $fetch<{ message: string }>("/auth/forgot-password", {
        baseURL: config.public.apiBaseUrl,
        method: "POST",
        body: { email: form.email }
      });
      successMessage.value = result.message;
      return;
    }
    if (mode.value === "register") await auth.register(form);
    else await auth.login({ email: form.email, password: form.password });
    await router.push("/");
  } catch (error) {
    const fallback = mode.value === "register" ? "No se pudo crear la cuenta" : mode.value === "forgot" ? "No se pudo enviar el correo" : "No se pudo iniciar sesion";
    showApiError(error, fallback);
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
          <h1 class="text-xl font-semibold">{{ mode === 'forgot' ? 'Recuperar contrasena' : mode === 'login' ? 'Tu cuenta' : 'Crear cuenta' }}</h1>
          <p class="mt-1 text-sm text-gray-500">{{ mode === 'forgot' ? 'Te enviaremos un enlace seguro si existe una cuenta asociada.' : 'Recupera equipos e historial desde cualquier dispositivo.' }}</p>
        </div>
      </template>
      <div class="space-y-4">
        <div v-if="mode !== 'forgot'" class="grid grid-cols-2 rounded-md bg-gray-100 p-1 dark:bg-gray-800">
          <button class="rounded px-3 py-2 text-sm font-medium" :class="mode === 'login' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'" @click="mode = 'login'">Acceder</button>
          <button class="rounded px-3 py-2 text-sm font-medium" :class="mode === 'register' ? 'bg-white shadow-sm dark:bg-gray-900' : 'text-gray-500'" @click="mode = 'register'">Registrarme</button>
        </div>
        <UForm :state="form" class="space-y-4" @submit="submit">
          <UFormGroup v-if="mode === 'register'" label="Nombre visible" required><UInput v-model="form.displayName" minlength="2" maxlength="40" autocomplete="name" /></UFormGroup>
          <UFormGroup label="Correo" required><UInput v-model="form.email" type="email" maxlength="254" autocomplete="email" /></UFormGroup>
          <UFormGroup v-if="mode !== 'forgot'" label="Contrasena" required><UInput v-model="form.password" type="password" minlength="8" maxlength="128" :autocomplete="mode === 'login' ? 'current-password' : 'new-password'" /></UFormGroup>
          <UButton type="submit" block color="teal" :icon="mode === 'forgot' ? 'i-lucide-mail' : 'i-lucide-arrow-right'" :loading="loading">{{ mode === 'forgot' ? 'Enviar enlace' : mode === 'login' ? 'Entrar' : 'Crear cuenta' }}</UButton>
        </UForm>
        <p v-if="successMessage" role="status" class="rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950 dark:text-teal-100">{{ successMessage }}</p>
        <button v-if="mode === 'login'" type="button" class="w-full text-center text-sm font-medium text-teal-700 hover:underline dark:text-teal-300" @click="mode = 'forgot'; successMessage = ''">Olvide mi contrasena</button>
        <button v-if="mode === 'forgot'" type="button" class="w-full text-center text-sm font-medium text-teal-700 hover:underline dark:text-teal-300" @click="mode = 'login'; successMessage = ''">Volver a iniciar sesion</button>
        <p v-if="mode !== 'forgot'" class="text-center text-xs text-gray-500">La cuenta es opcional. Las salas abiertas siguen funcionando sin registro.</p>
      </div>
    </UCard>
  </main>
</template>
