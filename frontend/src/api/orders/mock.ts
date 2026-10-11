// Mock orders provider — realistic surplus-vial orders so
// the Orders tab is exercised in preview. Mirrors the live
// connector contract (/me/orders, /me/orders/{id}).

import type { Order } from "@/src/types/order";

import type { OrdersProvider } from "./provider";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const ORDERS: Order[] = [
  {
    id: 10234,
    number: "APS-10234",
    dateCreated: "2026-06-04T10:12:00Z",
    status: "completed",
    total: "£96.00",
    itemCount: 3,
    lines: [
      {
        id: 1,
        name: "Surplus Vial — Batch 24A",
        quantity: 2,
        total: "£64.00",
        image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=400&q=80",
      },
      {
        id: 2,
        name: "Surplus Vial — Batch 19C",
        quantity: 1,
        total: "£32.00",
        image: "https://images.unsplash.com/photo-1587854692152-cbe660dbde88?w=400&q=80",
      },
    ],
    fulfilment: null,
  },
  {
    id: 10251,
    number: "APS-10251",
    dateCreated: "2026-06-09T08:02:00Z",
    status: "processing",
    total: "£32.00",
    itemCount: 1,
    lines: [
      {
        id: 3,
        name: "Surplus Vial — Batch 31B",
        quantity: 1,
        total: "£32.00",
        image: "https://images.unsplash.com/photo-1631549916768-4119b2e5f926?w=400&q=80",
      },
    ],
    fulfilment: null,
  },
  {
    id: 10260,
    number: "APS-10260",
    dateCreated: "2026-06-10T06:45:00Z",
    status: "pending",
    total: "£48.00",
    itemCount: 1,
    lines: [
      {
        id: 4,
        name: "Surplus Vial — Batch 12D",
        quantity: 1,
        total: "£48.00",
        image: "https://images.unsplash.com/photo-1603398938378-e54eab446dde?w=400&q=80",
      },
    ],
    fulfilment: null,
  },
];

export const mockOrdersProvider: OrdersProvider = {
  async list() {
    await delay(500);
    return [...ORDERS].sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime(),
    );
  },
  async get(_token, id) {
    await delay(350);
    return ORDERS.find((o) => o.id === id) ?? null;
  },
};
