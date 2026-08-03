// ── Feature flags ────────────────────────────────────────────────────────────
// Central switchboard for the Apeps ecosystem. A module is "on" when its flag is
// true AND its registry status is not "planned". Flags can be overridden from
// remote config (Apeps App Connector /config) or env without code changes:
//   EXPO_PUBLIC_FLAGS="loyalty-dashboard,referral"   (comma list = force-enabled)
//
// This lets modules ship dark and be enabled per environment / rollout.

const envForced = (process.env.EXPO_PUBLIC_FLAGS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

// Baseline flags. Future modules default OFF until their build lands.
const DEFAULT_FLAGS: Record<string, boolean> = {
  "loyalty-dashboard": false,
  "reward-levels": false,
  "referral": false,
  "refill-club": false,
  "qr-authenticity": false,
  "product-verification": false,
  "live-tracking": false,
  "notification-centre": false,
  "security-centre": false,
  "educational-library": false,
  "ai-support": false,
};

// Remote overrides can be merged in at runtime (Phase 2) via setRemoteFlags().
let remoteFlags: Record<string, boolean> = {};

export function setRemoteFlags(flags: Record<string, boolean>) {
  remoteFlags = { ...flags };
}

export function isFlagEnabled(key?: string): boolean {
  if (!key) return true;
  if (envForced.includes(key)) return true;
  if (key in remoteFlags) return remoteFlags[key];
  return DEFAULT_FLAGS[key] ?? false;
}
