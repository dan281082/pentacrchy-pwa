// Live orders provider — Apeps App Connector /me/orders + /me/orders/{id}.
// Ownership-scoped by the connector; the app only formats allow-listed fields.

import { env } from "@/src/config/env";
import type { Order, OrderLine, OrderTracking } from "@/src/types/order";

import type { OrdersProvider } from "./provider";

const TIMEOUT = 15000;

const connectorUrl = (path: string): string =>
  `${env.appApiBaseUrl.replace(/\/$/, "")}/wp-json/apeps/v1${path}`;

async function request<T>(path: string, token: string): Promise<T> {
  const base = env.appApiBaseUrl.trim();
  if (!base.startsWith("https://")) throw new Error("Orders are not available yet.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  let res: Response;
  try {
    res = await fetch(connectorUrl(path), {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch {
    clearTimeout(timer);
    throw new Error("Network request failed.");
  }
  clearTimeout(timer);
  const text = await res.text();
  if (!res.ok) throw new Error(`Request failed (${res.status}).`);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("Unexpected response.");
  }
}

function mapTracking(raw: any): OrderTracking | null {
  if (!raw) return null;
  return {
    carrier: String(raw.carrier ?? ""),
    number: String(raw.number ?? ""),
    url: String(raw.url ?? ""),
    status: String(raw.status ?? ""),
    events: Array.isArray(raw.events)
      ? raw.events.map((e: any) => ({
          label: String(e.label ?? ""),
          date: e.date ? String(e.date) : null,
          done: Boolean(e.done),
        }))
      : [],
  };
}

function mapOrder(raw: any): Order {
  const lines: OrderLine[] = Array.isArray(raw.lines)
    ? raw.lines.map((l: any, i: number) => ({
        id: Number(l.id ?? i),
        name: String(l.name ?? ""),
        quantity: Number(l.quantity ?? 1),
        total: String(l.total ?? ""),
        image: l.image ? String(l.image) : null,
      }))
    : [];
  return {
    id: Number(raw.id ?? 0),
    number: String(raw.number ?? raw.id ?? ""),
    dateCreated: String(raw.dateCreated ?? raw.date_created ?? ""),
    status: String(raw.status ?? "pending") as Order["status"],
    total: String(raw.total ?? ""),
    itemCount: Number(raw.itemCount ?? lines.reduce((n, l) => n + l.quantity, 0)),
    lines,
    tracking: mapTracking(raw.tracking),
  };
}

export const liveOrdersProvider: OrdersProvider = {
  async list(token) {
    const raw = await request<any>("/me/orders", token);
    const arr = Array.isArray(raw) ? raw : (raw?.orders ?? []);
    return arr.map(mapOrder);
  },
  async get(token, id) {
    const raw = await request<any>(`/me/orders/${id}`, token);
    return raw ? mapOrder(raw) : null;
  },
};
