// Persistent basket (Zustand + storage). Survives app close, restart, offline.
// Prices/meta are stored EXACTLY as WooCommerce returned them at add-time; the
// app never recalculates prices — it only multiplies stored WC unit prices by
// quantity for a SUBTOTAL ESTIMATE. Final subtotal, VAT, shipping, discounts
// and total are confirmed by WooCommerce at checkout (Phase 2, Store API cart).

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { PriceInfo, Product, VariationDetail } from "@/src/types/catalogue";

import { zustandStorage } from "./persist";

export interface BasketLine {
  key: string;
  productId: number;
  variationId: number | null;
  slug: string;
  name: string;
  image: string | null;
  variationLabel: string;
  unitPriceMinor: string;
  priceMeta: PriceInfo;
  quantity: number;
  soldIndividually: boolean;
}

interface BasketState {
  lines: BasketLine[];
  couponCode: string | null;
  addItem: (
    product: Product,
    quantity: number,
    variation?: VariationDetail | null,
  ) => void;
  setQuantity: (key: string, quantity: number) => void;
  increment: (key: string) => void;
  decrement: (key: string) => void;
  remove: (key: string) => void;
  clear: () => void;
  setCoupon: (code: string | null) => void;
}

const lineKey = (productId: number, variationId: number | null) =>
  variationId ? `${productId}:${variationId}` : `${productId}`;

const variationLabel = (v?: VariationDetail | null) =>
  v ? Object.values(v.attributes).join(" · ") : "";

export const useBasketStore = create<BasketState>()(
  persist(
    (set) => ({
      lines: [],
      couponCode: null,

      addItem: (product, quantity, variation) =>
        set((state) => {
          const variationId = variation?.id ?? null;
          const key = lineKey(product.id, variationId);
          const meta = variation?.prices ?? product.prices;
          const unit = variation?.prices?.price ?? product.prices.price;
          const existing = state.lines.find((l) => l.key === key);
          if (existing) {
            const nextQty = product.soldIndividually ? 1 : existing.quantity + quantity;
            return {
              lines: state.lines.map((l) =>
                l.key === key ? { ...l, quantity: nextQty } : l,
              ),
            };
          }
          const line: BasketLine = {
            key,
            productId: product.id,
            variationId,
            slug: product.slug,
            name: product.name,
            image: (variation?.image ?? product.images[0])?.src ?? null,
            variationLabel: variationLabel(variation),
            unitPriceMinor: unit,
            priceMeta: meta,
            quantity: product.soldIndividually ? 1 : quantity,
            soldIndividually: product.soldIndividually,
          };
          return { lines: [...state.lines, line] };
        }),

      setQuantity: (key, quantity) =>
        set((state) => ({
          lines: state.lines
            .map((l) => (l.key === key ? { ...l, quantity: Math.max(0, quantity) } : l))
            .filter((l) => l.quantity > 0),
        })),

      increment: (key) =>
        set((state) => ({
          lines: state.lines.map((l) =>
            l.key === key && !l.soldIndividually ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        })),

      decrement: (key) =>
        set((state) => ({
          lines: state.lines
            .map((l) => (l.key === key ? { ...l, quantity: l.quantity - 1 } : l))
            .filter((l) => l.quantity > 0),
        })),

      remove: (key) => set((state) => ({ lines: state.lines.filter((l) => l.key !== key) })),
      clear: () => set({ lines: [], couponCode: null }),
      setCoupon: (code) => set({ couponCode: code }),
    }),
    {
      name: "apeps.basket.v1",
      storage: createJSONStorage(() => zustandStorage),
      partialize: (s) => ({ lines: s.lines, couponCode: s.couponCode }),
    },
  ),
);

// Selectors
export const selectItemCount = (s: BasketState) =>
  s.lines.reduce((n, l) => n + l.quantity, 0);

export const selectSubtotalMinor = (s: BasketState) =>
  s.lines.reduce((sum, l) => sum + (parseInt(l.unitPriceMinor, 10) || 0) * l.quantity, 0);
