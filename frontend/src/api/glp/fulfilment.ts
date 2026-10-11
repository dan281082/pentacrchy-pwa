// Staff fulfilment API. Every route is protected server-side by the WordPress
// `glp_fulfil_orders` capability — the app hiding the tab is UX only.

import type { FulfilmentState, LabelFile, OrderLabel } from "@/src/types/order";
import { stripHtml } from "@/src/utils/html";

import { glpFetch } from "./client";
import { mapFulfilmentState, mapLabel, mapLabelFile } from "./orders";

export interface FulfilmentSummary {
  id: number;
  number: string;
  status: string;
  state: FulfilmentState;
  stateLabel: string;
  dateCreated: string;
  datePaid: string | null;
  customerName: string;
  itemCount: number;
  total: string;
  labelKind: "label" | "qr" | null;
  telegram: string;
}

export interface FulfilmentDetail extends FulfilmentSummary {
  items: { name: string; qty: number; sku: string; attributes: Record<string, string> }[];
  customer: { name: string; email: string; phone: string; telegram: string };
  shippingAddress: { name: string; line1: string; line2: string; city: string; postcode: string; country: string };
  customerNote: string;
  label: OrderLabel | null;
  dispatchedAt: string | null;
  log: { event: string; by: string; at: string }[];
}

export type FulfilmentCounts = Record<FulfilmentState, number>;

function mapSummary(o: any): FulfilmentSummary {
  return {
    id: Number(o?.id ?? 0),
    number: String(o?.number ?? o?.id ?? ""),
    status: String(o?.status ?? ""),
    state: mapFulfilmentState(o?.state),
    stateLabel: String(o?.state_label ?? ""),
    dateCreated: String(o?.date_created ?? ""),
    datePaid: o?.date_paid ? String(o.date_paid) : null,
    customerName: String(o?.customer_name ?? ""),
    itemCount: Number(o?.item_count ?? 0),
    total: stripHtml(String(o?.total_display ?? "")),
    telegram: String(o?.telegram ?? ""),
    labelKind: o?.label_kind === "qr" ? "qr" : o?.label_kind === "label" ? "label" : null,
  };
}

function mapDetail(raw: any): FulfilmentDetail {
  const o = raw?.order ?? raw;
  const a = o?.shipping_address ?? {};
  const c = o?.customer ?? {};
  return {
    ...mapSummary(o),
    items: Array.isArray(o?.items)
      ? o.items.map((i: any) => ({
          name: stripHtml(String(i?.name ?? "")),
          qty: Number(i?.qty ?? 1),
          sku: String(i?.sku ?? ""),
          attributes: i?.attributes && typeof i.attributes === "object" && !Array.isArray(i.attributes) ? i.attributes : {},
        }))
      : [],
    customer: {
      name: String(c.name ?? ""),
      email: String(c.email ?? ""),
      phone: String(c.phone ?? ""),
      telegram: String(c.telegram ?? ""),
    },
    shippingAddress: {
      name: String(a.name ?? ""),
      line1: String(a.line1 ?? ""),
      line2: String(a.line2 ?? ""),
      city: String(a.city ?? ""),
      postcode: String(a.postcode ?? ""),
      country: String(a.country ?? ""),
    },
    customerNote: String(o?.customer_note ?? ""),
    label: mapLabel(o?.label),
    dispatchedAt: o?.dispatched_at ? String(o.dispatched_at) : null,
    log: Array.isArray(o?.log)
      ? o.log.map((l: any) => ({ event: String(l?.event ?? ""), by: String(l?.by ?? ""), at: String(l?.at ?? "") }))
      : [],
  };
}

export const glpFulfilment = {
  async list(): Promise<{ orders: FulfilmentSummary[]; counts: FulfilmentCounts }> {
    const raw = await glpFetch<any>("/fulfilment/orders?state=all");
    const c = raw?.counts ?? {};
    return {
      orders: Array.isArray(raw?.orders) ? raw.orders.map(mapSummary) : [],
      counts: {
        awaiting_label: Number(c.awaiting_label ?? 0),
        label_supplied: Number(c.label_supplied ?? 0),
        ready: Number(c.ready ?? 0),
        dispatched: Number(c.dispatched ?? 0),
      },
    };
  },
  async get(id: number): Promise<FulfilmentDetail> {
    return mapDetail(await glpFetch<any>(`/fulfilment/orders/${id}`));
  },
  async label(id: number): Promise<LabelFile> {
    return mapLabelFile(await glpFetch<any>(`/fulfilment/orders/${id}/label`, { retries: 1 }));
  },
  async markReady(id: number): Promise<FulfilmentDetail> {
    return mapDetail(await glpFetch<any>(`/fulfilment/orders/${id}/ready`, { method: "POST", body: {}, retries: 0 }));
  },
  async dispatch(id: number): Promise<FulfilmentDetail> {
    return mapDetail(await glpFetch<any>(`/fulfilment/orders/${id}/dispatch`, { method: "POST", body: {}, retries: 0 }));
  },
};
