import { z } from "zod";

import { getJson } from "@/src/api/client";
import { env } from "@/src/config/env";
import { appApiUrl } from "@/src/modules/shared/api-helpers";

import type { OrderTracking } from "./types";

// PROVISIONAL — final path/fields depend on the tracking plugin surfaced by the
// Apeps App Connector, scoped to the authenticated customer's own order.
export const TRACKING_ENDPOINTS = {
  order: (orderId: number) => `/orders/${orderId}/tracking`, // PROVISIONAL
} as const;

const eventSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  status: z.string().default(""),
  description: z.string().default(""),
  timestamp: z.string(),
  location: z.string().nullable().default(null),
});

export const trackingSchema = z.object({
  order_id: z.number(),
  order_number: z.string().default(""),
  order_status: z.string().default(""),
  dispatch_date: z.string().nullable().default(null),
  courier: z.string().nullable().default(null),
  tracking_number: z.string().nullable().default(null),
  tracking_url: z.string().nullable().default(null),
  estimated_delivery: z.string().nullable().default(null),
  events: z.array(eventSchema).default([]),
});

export function parseTracking(raw: unknown): OrderTracking {
  const d = trackingSchema.parse(raw);
  return {
    orderId: d.order_id,
    orderNumber: d.order_number,
    orderStatus: d.order_status,
    dispatchDate: d.dispatch_date,
    courier: d.courier,
    trackingNumber: d.tracking_number,
    trackingUrl: d.tracking_url,
    estimatedDelivery: d.estimated_delivery,
    events: d.events.map((e) => ({
      id: e.id,
      status: e.status,
      description: e.description,
      timestamp: e.timestamp,
      location: e.location,
    })),
  };
}

// Safe empty tracking — no invented courier data.
const empty = (orderId: number): OrderTracking => ({
  orderId,
  orderNumber: "",
  orderStatus: "",
  dispatchDate: null,
  courier: null,
  trackingNumber: null,
  trackingUrl: null,
  estimatedDelivery: null,
  events: [],
});

const mockAdapter = {
  async getTracking(orderId: number): Promise<OrderTracking> {
    return empty(orderId);
  },
};

const liveAdapter = {
  async getTracking(orderId: number): Promise<OrderTracking> {
    const { data } = await getJson<unknown>(appApiUrl(TRACKING_ENDPOINTS.order(orderId)));
    return parseTracking(data);
  },
};

export const trackingApi = env.dataSource === "live" ? liveAdapter : mockAdapter;

// PROVISIONAL sample — unit tests only, never rendered.
export const __PROVISIONAL_TRACKING_RAW = {
  order_id: 1001,
  order_number: "1001",
  order_status: "processing",
  dispatch_date: "2026-05-02T09:00:00Z",
  courier: "Royal Mail",
  tracking_number: "AB123456789GB",
  tracking_url: "https://www.royalmail.com/track-your-item#/tracking-results/AB123456789GB",
  estimated_delivery: null,
  events: [
    { id: 1, status: "dispatched", description: "Item dispatched", timestamp: "2026-05-02T09:00:00Z", location: "Depot" },
  ],
};
