import { defineStore } from "pinia";

export const useConnectionStore = defineStore("connection", {
  state: () => ({
    connected: false,
    reconnecting: false,
    error: null as string | null
  }),
  actions: {
    setConnected(value: boolean) {
      this.connected = value;
      this.reconnecting = !value;
    },
    setError(message: string | null) {
      this.error = message;
    }
  }
});
