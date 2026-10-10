// ── Orders domain model ──────────────────────────────────────────────────────
// Ownership-scoped order history + shipment tracking. The app formats WooCommerce
// values verbatim and never invents amounts, dates or tracking events.

export type OrderStatus =
  | "pending"
  | "processing"
  | "on-hold"
  | "completed"
  | "cancelled"
  | "refunded"
  | "failed";

export interface OrderLine {
  id: number;
  name: string;
  quantity: number;
  total: string; // formatted, e.g. "£48.00"
  image: string | null;
}

export interface TrackingEvent {
  label: string;
  date: string | null;
  done: boolean;
}

export interface OrderTracking {
  carrier: string;
  number: string;
  url: string;
  status: string;
  events: TrackingEvent[];
}

export interface Order {
  id: number;
  number: string;
  dateCreated: string; // ISO
  status: OrderStatus;
  total: string; // formatted
  itemCount: number;
  lines: OrderLine[];
  tracking: OrderTracking | null;
}
