const TEXT_ENTRY_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function canMoveInTeamRoom(
  activeElement: Element | null,
  canvas: HTMLCanvasElement,
  windowHasFocus: boolean
) {
  if (!windowHasFocus || activeElement !== canvas) return false;

  const active = activeElement as HTMLElement;
  return !TEXT_ENTRY_TAGS.has(active.tagName)
    && !active.isContentEditable
    && active.getAttribute("role") !== "textbox";
}
