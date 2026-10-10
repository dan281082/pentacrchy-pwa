// ── Apeps ecosystem module registry ─────────────────────────────────────────
// SINGLE PLACE to declare modules. To add a real module later:
//   1) flip status: "available" (+ set flagKey enabled in feature-flags/remote)
//   2) either point `route` at a dedicated screen, OR register a component in
//      component-map.tsx (the generic /module/[id] host renders it).
// No navigation restructuring is needed — Account/hub screens read this list.
//
// Customer modules render in the app. The Owner/Admin dashboard is realm:"admin"
// and is NEVER surfaced here in the customer app — it must be a separate app
// with its own authentication, permissions and MFA (see docs).

import type { ModuleDefinition } from "./types";
import { isFlagEnabled } from "@/src/config/feature-flags";

export const MODULES: ModuleDefinition[] = [
  // ── Trust & product ──
  // Live order tracking is surfaced inside My Orders (per order). This registry
  // entry keeps groundwork for a standalone tracking hub if needed later.
  {
    id: "live-tracking",
    title: "Live order tracking",
    description: "Follow your delivery in real time.",
    icon: "location-outline",
    group: "Orders",
    realm: "customer",
    status: "beta",
    requiresAuth: true,
    placement: [], // tracking lives in My Orders; not surfaced as a separate hub
    flagKey: "live-tracking",
    order: 10,
  },
];

/** Modules visible to customers at a given placement, honouring feature flags. */
export function getCustomerModules(placement: "account" | "home" | "hub"): ModuleDefinition[] {
  return MODULES.filter(
    (m) =>
      m.realm === "customer" &&
      m.placement.includes(placement) &&
      // "planned" modules are shown as a roadmap teaser; "available"/"beta"
      // additionally require their feature flag to be enabled.
      (m.status === "planned" || isFlagEnabled(m.flagKey)),
  ).sort((a, b) => a.order - b.order);
}

export function getModuleById(id: string): ModuleDefinition | undefined {
  return MODULES.find((m) => m.id === id);
}

/** Group a list of modules by their `group` for sectioned rendering. */
export function groupModules(mods: ModuleDefinition[]): { group: string; items: ModuleDefinition[] }[] {
  const map = new Map<string, ModuleDefinition[]>();
  for (const m of mods) {
    const arr = map.get(m.group) ?? [];
    arr.push(m);
    map.set(m.group, arr);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
}
