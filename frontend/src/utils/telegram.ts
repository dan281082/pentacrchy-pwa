// Telegram username normalisation + validation.
// Telegram usernames use a–z, 0–9 and underscore, are case-insensitive and
// 5–32 chars. We strip a leading "@", lowercase, and allow-list the characters.
// Syntax validity is NOT proof of Telegram ownership.

export interface TelegramResult {
  ok: boolean;
  value: string;
  error?: string;
}

export function normalizeTelegram(raw: string | undefined | null): TelegramResult {
  const trimmed = (raw ?? "").trim().replace(/^@+/, "").toLowerCase();
  if (!trimmed) {
    return { ok: false, value: "", error: "Telegram username is required." };
  }
  if (!/^[a-z0-9_]{5,32}$/.test(trimmed)) {
    return { ok: false, value: trimmed, error: "Use 5–32 letters, numbers or underscores." };
  }
  return { ok: true, value: trimmed };
}

/** Always returns the "@username" display form from any stored/raw value. */
export function displayTelegram(value: string): string {
  const v = (value ?? "").trim().replace(/^@+/, "");
  return v ? `@${v}` : "";
}
