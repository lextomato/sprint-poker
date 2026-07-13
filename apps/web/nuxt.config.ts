export default defineNuxtConfig({
  compatibilityDate: "2026-07-10",
  devtools: { enabled: true },
  app: {
    head: {
      title: "Sprint Poker",
      meta: [{ name: "theme-color", content: "#0f172a" }],
      link: [
        { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
        { rel: "apple-touch-icon", href: "/brand/sprint-poker-mark.svg" }
      ]
    }
  },
  modules: ["@nuxt/ui", "@pinia/nuxt"],
  css: ["~/assets/css/main.css"],
  typescript: {
    strict: true,
    typeCheck: true
  },
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1",
      socketUrl: process.env.NUXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
      giphyApiKey: process.env.NUXT_PUBLIC_GIPHY_API_KEY ?? ""
    }
  },
  vite: {
    optimizeDeps: {
      include: ["socket.io-client"]
    }
  },
  build: {
    transpile: ["@planning/shared"]
  }
});
