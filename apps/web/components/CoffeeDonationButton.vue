<script setup lang="ts">
const paypalUrl = "https://paypal.me/JhojanyUzcategui";
</script>

<template>
  <a
    :href="paypalUrl"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Aportar un cafe por PayPal para apoyar Sprint Poker"
    title="Apoya Sprint Poker con PayPal"
    class="fixed bottom-4 right-4 z-[80] flex min-h-14 items-center gap-3 rounded-full border border-amber-500 bg-[#ffc439] px-4 py-2.5 text-slate-950 shadow-lg shadow-slate-950/20 transition hover:-translate-y-0.5 hover:bg-[#ffcf5c] hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 sm:bottom-6 sm:right-6"
  >
    <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-amber-700 shadow-sm">
      <UIcon name="i-lucide-coffee" class="h-5 w-5" />
    </span>
    <span class="flex min-w-0 flex-col text-left leading-tight">
      <span class="whitespace-nowrap text-sm font-bold">Donar un cafe</span>
      <span class="whitespace-nowrap text-[11px] font-medium text-slate-700">por PayPal</span>
    </span>
    <UIcon name="i-lucide-external-link" class="h-4 w-4 shrink-0 text-slate-700" />
  </a>
</template>
