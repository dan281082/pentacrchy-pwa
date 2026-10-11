// GLP checkout + crypto bridge. The Apeps Crypto Payments Gateway stays
// authoritative for invoices/confirmations; the app only reads its state.

import { glpFetch } from "./client";

export interface ShippingMethod {
  id: string;
  label: string;
  cost: string;
  costDisplay: string;
}

export interface CryptoNetwork {
  id: string;
  label: string;
  chain: string;
  standard: string;
  token: string;
}

export interface CryptoInvoice {
  orderId: number;
  network: string;
  networkLabel: string;
  token: string;
  address: string;
  amount: string; // USDT, display
  amountPaid: string;
  amountRemaining: string;
  fiatTotal: string;
  fiatCurrency: string;
  status: string; // awaiting_payment | payment_detected | confirming | complete | expired | ...
  statusLabel: string;
  instruction: string;
  confirmations: number;
  requiredConfirmations: number;
  txHash: string;
  explorerUrl: string;
  remainingSeconds: number;
  isFinal: boolean;
  paymentUri: string;
  testMode: boolean;
}

export interface OrderItemInput {
  product_id: number;
  variation_id?: number | null;
  qty: number;
}

export interface ShippingAddressInput {
  name: string;
  first_name: string;
  last_name: string;
  line1: string;
  line2?: string;
  city: string;
  postcode: string;
  country: string;
  phone: string;
}

export function mapInvoice(raw: any): CryptoInvoice {
  const i = raw?.invoice ?? raw ?? {};
  return {
    orderId: Number(i.order_id ?? 0),
    network: String(i.network ?? ""),
    networkLabel: String(i.network_label ?? ""),
    token: String(i.token ?? "USDT"),
    address: String(i.address ?? ""),
    amount: String(i.amount ?? ""),
    amountPaid: String(i.amount_paid ?? "0"),
    amountRemaining: String(i.amount_remaining ?? i.amount ?? ""),
    fiatTotal: String(i.fiat_total ?? ""),
    fiatCurrency: String(i.fiat_currency ?? "GBP"),
    status: String(i.status ?? "awaiting_payment"),
    statusLabel: String(i.status_label ?? ""),
    instruction: String(i.customer_instruction ?? ""),
    confirmations: Number(i.confirmations ?? 0),
    requiredConfirmations: Number(i.required_confirmations ?? 0),
    txHash: String(i.tx_hash ?? ""),
    explorerUrl: String(i.explorer_url ?? ""),
    remainingSeconds: Number(i.remaining_seconds ?? 0),
    isFinal: Boolean(i.is_final),
    paymentUri: String(i.payment_uri ?? ""),
    testMode: Boolean(i.test_mode),
  };
}

export const glpCheckout = {
  async networks(): Promise<CryptoNetwork[]> {
    const raw = await glpFetch<any>("/crypto/networks");
    const list = Array.isArray(raw?.networks) ? raw.networks : [];
    return list.map((n: any) => ({
      id: String(n.id ?? ""),
      label: String(n.label ?? ""),
      chain: String(n.chain ?? ""),
      standard: String(n.standard ?? ""),
      token: String(n.token ?? "USDT"),
    }));
  },

  async validateBasket(items: OrderItemInput[]) {
    return glpFetch<any>("/basket/validate", { method: "POST", body: { items } });
  },

  async quoteShipping(items: OrderItemInput[], address: ShippingAddressInput): Promise<ShippingMethod[]> {
    const raw = await glpFetch<any>("/shipping/quote", { method: "POST", body: { items, address } });
    const list = Array.isArray(raw?.methods) ? raw.methods : [];
    return list.map((m: any) => ({
      id: String(m.id ?? ""),
      label: String(m.label ?? m.title ?? ""),
      cost: String(m.cost ?? ""),
      costDisplay: String(m.cost_display ?? m.cost ?? ""),
    }));
  },

  /** Creates the WooCommerce order + crypto invoice. Throws GlpError (code
   *  'basket_invalid', data.validation) if stock changed server-side. */
  async createOrder(payload: {
    items: OrderItemInput[];
    shipping_address: ShippingAddressInput;
    shipping_method: string;
    network: string;
    client_ref: string;
  }): Promise<{ orderId: number; number: string; status: string; invoice: CryptoInvoice | null }> {
    const raw = await glpFetch<any>("/orders", {
      method: "POST",
      body: { ...payload, payment_method: "crypto" },
    });
    const o = raw?.order ?? raw;
    return {
      orderId: Number(o?.id ?? 0),
      number: String(o?.number ?? o?.id ?? ""),
      status: String(o?.status ?? "pending"),
      invoice: o?.crypto || o?.invoice ? mapInvoice(o.crypto ?? o.invoice) : null,
    };
  },

  async getInvoice(orderId: number): Promise<CryptoInvoice> {
    const raw = await glpFetch<any>(`/orders/${orderId}/crypto-invoice`);
    return mapInvoice(raw);
  },

  async recheck(orderId: number): Promise<CryptoInvoice> {
    const raw = await glpFetch<any>(`/orders/${orderId}/crypto-recheck`, { method: "POST", body: {} });
    return mapInvoice(raw);
  },
};
