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
  // ── Rewards & membership ──
  {
    id: "loyalty-dashboard",
    title: "Loyalty dashboard",
    description: "Track points, activity and redemption value.",
    icon: "sparkles-outline",
    group: "Rewards & membership",
    realm: "customer",
    status: "planned",
    requiresAuth: true,
    placement: ["account", "home"],
    flagKey: "loyalty-dashboard",
    order: 10,
  },
  {
    id: "reward-levels",
    title: "Reward levels",
    description: "Your membership tier and progress.",
    icon: "trophy-outline",
    group: "Rewards & membership",
    realm: "customer",
    status: "planned",
    requiresAuth: true,
    placement: ["account"],
    flagKey: "reward-levels",
    order: 20,
  },
  {
    id: "referral",
    title: "Refer a friend",
    description: "Share your link and earn rewards.",
    icon: "gift-outline",
    group: "Rewards & membership",
    realm: "customer",
    status: "planned",
    requiresAuth: true,
    placement: ["account"],
    flagKey: "referral",
    order: 30,
  },
  {
    id: "refill-club",
    title: "Refill Club",
    description: "Set up recurring refills of your essentials.",
    icon: "repeat-outline",
    group: "Rewards & membership",
    realm: "customer",
    status: "planned",
    requiresAuth: true,
    placement: ["account", "home"],
    flagKey: "refill-club",
    order: 40,
  },

  // ── Trust & product ──
  {
    id: "qr-authenticity",
    title: "Authenticity checker",
    description: "Scan a QR code to verify a genuine product.",
    icon: "qr-code-outline",
    group: "Trust & product",
    realm: "customer",
    status: "planned",
    requiresAuth: false,
    placement: ["account", "home"],
    flagKey: "qr-authenticity",
    order: 50,
  },
  {
    id: "product-verification",
    title: "Product verification",
    description: "Confirm batch and product details.",
    icon: "shield-checkmark-outline",
    group: "Trust & product",
    realm: "customer",
    status: "planned",
    requiresAuth: false,
    placement: ["account"],
    flagKey: "product-verification",
    order: 60,
  },
  {
    id: "live-tracking",
    title: "Live order tracking",
    description: "Follow your delivery in real time.",
    icon: "location-outline",
    group: "Trust & product",
    realm: "customer",
    status: "planned",
    requiresAuth: true,
    placement: ["account"],
    flagKey: "live-tracking",
    order: 70,
  },

  // ── Support & learning ──
  {
    id: "notification-centre",
    title: "Notification centre",
    description: "Manage alerts and see past notifications.",
    icon: "notifications-outline",
    group: "Support & learning",
    realm: "customer",
    status: "planned",
    requiresAuth: true,
    placement: ["account"],
    flagKey: "notification-centre",
    order: 80,
  },
  {
    id: "security-centre",
    title: "Account security",
    description: "Devices, sessions and security settings.",
    icon: "lock-closed-outline",
    group: "Support & learning",
    realm: "customer",
    status: "planned",
    requiresAuth: true,
    placement: ["account"],
    flagKey: "security-centre",
    order: 90,
  },
  {
    id: "educational-library",
    title: "Learn",
    description: "Approved guides and product information.",
    icon: "book-outline",
    group: "Support & learning",
    realm: "customer",
    status: "planned",
    requiresAuth: false,
    placement: ["account", "home"],
    flagKey: "educational-library",
    order: 100,
  },
  {
    id: "ai-support",
    title: "Support assistant",
    description: "Get quick help with orders and account.",
    icon: "chatbubbles-outline",
    group: "Support & learning",
    realm: "customer",
    status: "planned",
    requiresAuth: true,
    placement: ["account"],
    flagKey: "ai-support",
    order: 110,
  },

  // ── Admin realm — DO NOT render in the customer app (separate app + auth) ──
  {
    id: "owner-dashboard",
    title: "Owner dashboard",
    description: "Separate admin app — separate authentication & MFA.",
    icon: "briefcase-outline",
    group: "Admin",
    realm: "admin",
    status: "planned",
    requiresAuth: true,
    placement: [], // never surfaced in the customer app
    order: 999,
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
