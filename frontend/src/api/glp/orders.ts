// GLP orders provider — maps GLP order payloads into the app's Order model
// (My Orders + customer-supplied postage label). Formats values verbatim.

import type {
  FulfilmentState,
  LabelFile,
  LabelKind,
  Order,
  OrderFulfilment,
  OrderLabel,
  OrderLine,
  OrderStatus,
} from "@/src/types/order";
import { stripHtml } from "@/src/utils/html";

import type { OrdersProvider } from "../orders/provider";
import { glpFetch } from "./client";

const STATUSES: OrderStatus[] = [
  "pending",
  "processing",
  "on-hold",
  "completed",
  "cancelled",
  "refunded",
  "failed",
];

const STATES: FulfilmentState[] = ["awaiting_label", "label_supplied", "ready", "dispatched"];

function mapStatus(s: unknown): OrderStatus {
  const v = String(s ?? "").toLowerCase();
  return (STATUSES as string[]).includes(v) ? (v as OrderStatus) : "pending";
}

export function mapFulfilmentState(s: unknown): FulfilmentState {
  const v = String(s ?? "");
  return (STATES as string[]).includes(v) ? (v as FulfilmentState) : "awaiting_label";
}

export function mapLabel(l: any): OrderLabel | null {
  if (!l) return null;
  return {
    kind: l.kind === "qr" ? "qr" : "label",
    mime: String(l.mime ?? ""),
    filename: String(l.filename ?? ""),
    size: Number(l.size ?? 0),
    uploadedAt: String(l.uploaded_at ?? ""),
  };
}

export function mapLabelFile(raw: any): LabelFile {
  const l = raw?.label ?? raw;
  return { ...(mapLabel(l) as OrderLabel), data: String(l?.data ?? "") };
}

function mapFulfilment(f: any): OrderFulfilment | null {
  if (!f) return null;
  return {
    state: mapFulfilmentState(f.state),
    stateLabel: String(f.state_label ?? ""),
    label: mapLabel(f.label),
    canUpload: Boolean(f.can_upload),
    dispatchedAt: f.dispatched_at ? String(f.dispatched_at) : null,
  };
}

function mapOrder(o: any): Order {
  const lines: OrderLine[] = Array.isArray(o?.items)
    ? o.items.map((l: any, i: number) => ({
        id: Number(l?.id ?? i),
        name: stripHtml(String(l?.name ?? "")),
        quantity: Number(l?.qty ?? l?.quantity ?? 1),
        total: stripHtml(String(l?.total_display ?? l?.total ?? "")),
        image: l?.image_url ? String(l.image_url) : null,
      }))
    : [];
  return {
    id: Number(o?.id ?? 0),
    number: String(o?.number ?? o?.id ?? ""),
    dateCreated: String(o?.created ?? o?.date_created ?? ""),
    status: mapStatus(o?.status),
    total: stripHtml(String(o?.total_display ?? o?.total ?? "")),
    itemCount: lines.length ? lines.reduce((n, l) => n + l.quantity, 0) : Number(o?.item_count ?? 0),
    lines,
    fulfilment: mapFulfilment(o?.fulfilment),
  };
}

export const glpOrdersProvider: OrdersProvider = {
  async list() {
    const raw = await glpFetch<any>("/orders");
    const arr = Array.isArray(raw) ? raw : (raw?.orders ?? []);
    return arr
      .map(mapOrder)
      .sort((a: Order, b: Order) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime());
  },
  async get(_token, id) {
    const raw = await glpFetch<any>(`/orders/${id}`);
    const o = raw?.order ?? raw;
    return o ? mapOrder(o) : null;
  },
};

// Customer postage label — owner-scoped server-side.
export const glpLabels = {
  async get(orderId: number): Promise<LabelFile> {
    return mapLabelFile(await glpFetch<any>(`/orders/${orderId}/label`, { retries: 1 }));
  },
  async upload(orderId: number, input: { kind: LabelKind; filename: string; data: string }): Promise<Order> {
    const raw = await glpFetch<any>(`/orders/${orderId}/label`, { method: "POST", body: input, retries: 0 });
    return mapOrder(raw?.order ?? raw);
  },
};
