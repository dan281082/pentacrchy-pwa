// Mock orders provider — realistic surplus-vial orders with shipment tracking so
// the Orders tab and tracking timeline are exercised in preview. Mirrors the live
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
    tracking: {
      carrier: "Royal Mail",
      number: "RM123456789GB",
      url: "https://www.royalmail.com/track-your-item",
      status: "Delivered",
      events: [
        { label: "Order confirmed", date: "2026-06-04T10:12:00Z", done: true },
        { label: "Packed", date: "2026-06-04T15:40:00Z", done: true },
        { label: "Dispatched", date: "2026-06-05T09:05:00Z", done: true },
        { label: "Out for delivery", date: "2026-06-06T07:20:00Z", done: true },
        { label: "Delivered", date: "2026-06-06T13:48:00Z", done: true },
      ],
    },
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
    tracking: {
      carrier: "Royal Mail",
      number: "RM987654321GB",
      url: "https://www.royalmail.com/track-your-item",
      status: "Dispatched",
      events: [
        { label: "Order confirmed", date: "2026-06-09T08:02:00Z", done: true },
        { label: "Packed", date: "2026-06-09T16:10:00Z", done: true },
        { label: "Dispatched", date: "2026-06-10T09:30:00Z", done: true },
        { label: "Out for delivery", date: null, done: false },
        { label: "Delivered", date: null, done: false },
      ],
    },
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
    tracking: null,
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
