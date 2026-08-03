// ── Module component map ─────────────────────────────────────────────────────
// Maps a module id → its screen component for modules hosted by the generic
// /module/[id] route. When you BUILD a module, register it here (or give the
// module a dedicated `route` in registry.ts instead). Empty for now — every
// module is still "planned", so the generic host shows a roadmap placeholder.
//
// Example (future):
//   import { LoyaltyDashboard } from "./loyalty-dashboard/screen";
//   export const MODULE_COMPONENTS = { "loyalty-dashboard": LoyaltyDashboard };

import type { ComponentType } from "react";

export const MODULE_COMPONENTS: Record<string, ComponentType> = {};
