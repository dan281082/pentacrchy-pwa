// ── Module contract ──────────────────────────────────────────────────────────
// Every current and FUTURE Apeps ecosystem module is described by this shape.
// Adding a module later = add one entry to registry.ts (+ a screen/component).
// Nothing in the app hard-codes module lists — they are derived from the registry.

import type { Ionicons } from "@expo/vector-icons";

export type ModuleStatus = "available" | "beta" | "planned";

// Where a module can surface. A module may appear in several places.
export type ModulePlacement = "account" | "home" | "hub";

// Which auth realm a module belongs to. Customer modules live in this app;
// "admin" modules are the Owner/Admin dashboard which uses SEPARATE auth and is
// intentionally NOT rendered in the customer app (see registry.ts).
export type ModuleRealm = "customer" | "admin";

export interface ModuleDefinition {
  id: string; // stable slug — drives /module/[id]
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  group: string; // section heading used when rendering
  realm: ModuleRealm;
  status: ModuleStatus;
  requiresAuth: boolean; // gate behind customer sign-in (Phase 2)
  placement: ModulePlacement[];
  flagKey?: string; // feature-flags key; omit = always visible
  route?: string; // custom route; default is the generic /module/[id] host
  order: number;
}
