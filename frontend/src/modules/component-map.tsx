// ── Module component map ─────────────────────────────────────────────────────
// Maps a module id → its screen component for modules hosted by the generic
// /module/[id] route. Registered here once a module is scaffolded/built.
// Modules with `status: "planned"` (and no entry here) fall back to the roadmap
// placeholder in the host.

import type { ComponentType } from "react";

import { LiveTrackingScreen } from "./live-tracking";
import { LoyaltyDashboardScreen } from "./loyalty-dashboard";
import { NotificationCentreScreen } from "./notification-centre";
import { RefillClubScreen } from "./refill-club";

export const MODULE_COMPONENTS: Record<string, ComponentType> = {
  "loyalty-dashboard": LoyaltyDashboardScreen,
  "live-tracking": LiveTrackingScreen as ComponentType,
  "notification-centre": NotificationCentreScreen,
  "refill-club": RefillClubScreen,
};
