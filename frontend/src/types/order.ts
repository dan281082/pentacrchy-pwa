// ── Orders domain model ──────────────────────────────────────────────────────
// Ownership-scoped order history + customer-supplied postage label. The app
// formats WooCommerce values verbatim and never invents amounts or dates.

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

export type LabelKind = "label" | "qr";

export interface OrderLabel {
  kind: LabelKind;
  mime: string; // application/pdf | image/jpeg | image/png
  filename: string;
  size: number;
  uploadedAt: string;
}

/** Label file content (base64) fetched from an authenticated endpoint. */
export interface LabelFile extends OrderLabel {
  data: string;
}

export type FulfilmentState = "awaiting_label" | "label_supplied" | "ready" | "dispatched";

export interface OrderFulfilment {
  state: FulfilmentState;
  stateLabel: string;
  label: OrderLabel | null;
  canUpload: boolean;
  dispatchedAt: string | null;
}

export interface Order {
  id: number;
  number: string;
  dateCreated: string; // ISO
  status: OrderStatus;
  total: string; // formatted
  itemCount: number;
  lines: OrderLine[];
  fulfilment: OrderFulfilment | null; // null for orders not placed in the app
}
