import { FIBONACCI_DECK } from "@planning/shared";

export const planningDeckPresets: Array<{ label: string; values: string[] }> = [
  { label: "Fibonacci modificado", values: [...FIBONACCI_DECK] },
  { label: "Fibonacci clásico", values: ["0", "1", "2", "3", "5", "8", "13", "21", "34", "55", "89", "?"] },
  { label: "Tallas", values: ["XS", "S", "M", "L", "XL", "XXL", "?"] },
  { label: "Potencias de 2", values: ["1", "2", "4", "8", "16", "32", "64", "?"] }
];

const storageKey = "sprint_poker_selected_deck_v1";

export function normalizePlanningDeck(values: unknown): string[] {
  if (!Array.isArray(values)) return [...FIBONACCI_DECK];
  const normalized = values
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0 && value.length <= 16)
    .filter((value, index, deck) => deck.indexOf(value) === index)
    .slice(0, 30);
  return normalized.length ? normalized : [...FIBONACCI_DECK];
}

export function useDeckPreferences() {
  const deck = useState<string[]>("planning-selected-deck", () => [...FIBONACCI_DECK]);
  const loaded = useState<boolean>("planning-selected-deck-loaded", () => false);

  function load() {
    if (import.meta.server || loaded.value) return deck.value;
    try {
      deck.value = normalizePlanningDeck(JSON.parse(window.localStorage.getItem(storageKey) ?? "null"));
    } catch {
      deck.value = [...FIBONACCI_DECK];
    }
    loaded.value = true;
    return deck.value;
  }

  function save(values: string[]) {
    deck.value = normalizePlanningDeck(values);
    if (import.meta.client) window.localStorage.setItem(storageKey, JSON.stringify(deck.value));
  }

  function reset() {
    save([...FIBONACCI_DECK]);
  }

  return { deck, load, save, reset };
}
