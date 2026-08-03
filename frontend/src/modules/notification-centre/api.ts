import { z } from "zod";

import { getJson } from "@/src/api/client";
import { env } from "@/src/config/env";
import { appApiUrl } from "@/src/modules/shared/api-helpers";

import type { AppNotification, DeviceRegistration, NotificationPreferences } from "./types";

// PROVISIONAL endpoints — final paths depend on the Apeps App Connector.
export const NOTIFICATION_ENDPOINTS = {
  inbox: "/notifications", // PROVISIONAL
  markRead: (id: string) => `/notifications/${id}/read`, // PROVISIONAL
  preferences: "/notifications/preferences", // PROVISIONAL
  device: "/device/register", // matches the connector's public device endpoint
} as const;

const notificationSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string().default(""),
  body: z.string().default(""),
  category: z
    .enum(["order", "tracking", "restock", "offers", "loyalty", "reorder", "new-products", "security"])
    .catch("order"),
  read: z.boolean().default(false),
  created_at: z.string(),
  data: z
    .object({ productId: z.number().optional(), orderId: z.number().optional(), url: z.string().optional() })
    .optional(),
});

export function parseNotifications(raw: unknown): AppNotification[] {
  const arr = z.array(notificationSchema).parse(raw);
  return arr.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    category: n.category,
    read: n.read,
    createdAt: n.created_at,
    data: n.data,
  }));
}

// Transactional ON, marketing OFF — the compliant default.
export const DEFAULT_PREFERENCES: NotificationPreferences = {
  orderUpdates: true,
  trackingUpdates: true,
  restocks: false,
  newProducts: false,
  offers: false,
  loyalty: false,
  reorderReminders: false,
};

export const preferencesSchema = z.object({
  orderUpdates: z.boolean(),
  trackingUpdates: z.boolean(),
  restocks: z.boolean(),
  newProducts: z.boolean(),
  offers: z.boolean(),
  loyalty: z.boolean(),
  reorderReminders: z.boolean(),
});

export function parsePreferences(raw: unknown): NotificationPreferences {
  return { ...DEFAULT_PREFERENCES, ...preferencesSchema.partial().parse(raw ?? {}) };
}

interface NotificationAdapter {
  getInbox(): Promise<AppNotification[]>;
  getPreferences(): Promise<NotificationPreferences>;
  updatePreferences(prefs: NotificationPreferences): Promise<NotificationPreferences>;
  markRead(id: string): Promise<{ ok: true }>;
  registerDevice(reg: DeviceRegistration): Promise<{ ok: true }>;
}

const mockAdapter: NotificationAdapter = {
  async getInbox() {
    return []; // no fabricated notifications
  },
  async getPreferences() {
    return { ...DEFAULT_PREFERENCES };
  },
  async updatePreferences(prefs) {
    return prefs;
  },
  async markRead() {
    return { ok: true };
  },
  async registerDevice() {
    return { ok: true };
  },
};

const liveAdapter: NotificationAdapter = {
  async getInbox() {
    const { data } = await getJson<unknown>(appApiUrl(NOTIFICATION_ENDPOINTS.inbox));
    return parseNotifications(data);
  },
  async getPreferences() {
    const { data } = await getJson<unknown>(appApiUrl(NOTIFICATION_ENDPOINTS.preferences));
    return { ...DEFAULT_PREFERENCES, ...(data as object) };
  },
  async updatePreferences(prefs) {
    // PROVISIONAL: POST via the connector (write) — implemented in Phase 2.
    return prefs;
  },
  async markRead() {
    return { ok: true };
  },
  async registerDevice() {
    return { ok: true };
  },
};

export const notificationApi = env.dataSource === "live" ? liveAdapter : mockAdapter;

// PROVISIONAL sample — unit tests only.
export const __PROVISIONAL_NOTIFICATIONS_RAW = [
  { id: 1, title: "Order dispatched", body: "Your order is on its way.", category: "order", read: false, created_at: "2026-05-02T09:00:00Z", data: { orderId: 1001 } },
  { id: 2, title: "Back in stock", body: "An item you wanted is available.", category: "restock", read: true, created_at: "2026-05-03T09:00:00Z", data: { productId: 101 } },
];
