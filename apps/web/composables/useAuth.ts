import type { AuthSessionView, UserView } from "@planning/shared";

const authStorageKey = "sprint_poker_auth_token";

export function useAuth() {
  const config = useRuntimeConfig();
  const user = useState<UserView | null>("auth-user", () => null);
  const loaded = useState<boolean>("auth-loaded", () => false);

  function getToken() {
    return import.meta.client ? window.localStorage.getItem(authStorageKey) : null;
  }

  function headers(): Record<string, string> {
    const token = getToken();
    return token ? { "x-auth-token": token } : {};
  }

  function applySession(session: AuthSessionView) {
    window.localStorage.setItem(authStorageKey, session.token);
    user.value = session.user;
    loaded.value = true;
  }

  async function load() {
    if (loaded.value || import.meta.server) return user.value;
    const token = getToken();
    if (!token) {
      loaded.value = true;
      return null;
    }
    try {
      user.value = await $fetch<UserView>("/auth/me", { baseURL: config.public.apiBaseUrl, headers: { "x-auth-token": token } });
    } catch {
      window.localStorage.removeItem(authStorageKey);
      user.value = null;
    } finally {
      loaded.value = true;
    }
    return user.value;
  }

  async function register(payload: { email: string; password: string; displayName: string }) {
    const session = await $fetch<AuthSessionView>("/auth/register", { baseURL: config.public.apiBaseUrl, method: "POST", body: payload });
    applySession(session);
    return session;
  }

  async function login(payload: { email: string; password: string }) {
    const session = await $fetch<AuthSessionView>("/auth/login", { baseURL: config.public.apiBaseUrl, method: "POST", body: payload });
    applySession(session);
    return session;
  }

  async function logout() {
    const token = getToken();
    if (token) await $fetch("/auth/logout", { baseURL: config.public.apiBaseUrl, method: "POST", headers: { "x-auth-token": token } }).catch(() => undefined);
    window.localStorage.removeItem(authStorageKey);
    user.value = null;
    loaded.value = true;
  }

  return { user, loaded, getToken, headers, load, register, login, logout };
}
