export function sanitizeText(value: string): string {
  return value.replace(/[<>]/g, "").replace(/\s+/g, " ").trim();
}

export function sanitizeOptionalText(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  return sanitizeText(value);
}
