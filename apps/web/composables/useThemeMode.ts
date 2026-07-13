type ThemeMode = "light" | "dark";

const themeMode = ref<ThemeMode>("light");

function applyTheme(mode: ThemeMode) {
  if (import.meta.client) {
    document.documentElement.classList.toggle("dark", mode === "dark");
    document.documentElement.style.colorScheme = mode;
    window.localStorage.setItem("planning_theme", mode);
  }
}

export function useThemeMode() {
  function initTheme() {
    if (!import.meta.client) return;
    const saved = window.localStorage.getItem("planning_theme") as ThemeMode | null;
    const preferred = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    themeMode.value = saved ?? preferred;
    applyTheme(themeMode.value);
  }

  function toggleTheme() {
    themeMode.value = themeMode.value === "dark" ? "light" : "dark";
    applyTheme(themeMode.value);
  }

  return { themeMode, initTheme, toggleTheme };
}
