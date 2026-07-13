import { storeToRefs } from "pinia";

export function useConnectionStatus() {
  const connection = useConnectionStore();
  return storeToRefs(connection);
}
