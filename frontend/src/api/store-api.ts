// Live WooCommerce Store API provider (read-only catalogue).
// Endpoint: {base}/wp-json/wc/store/v1
// This is PUBLIC data — no secrets. On real devices React Native fetch has no
// CORS restriction, so this works on-device even though the build container /
// web preview may be blocked by the store's bot protection (see errors.ts).

import type {
  Category,
  PriceInfo,
  Product,
  ProductAttribute,
  ProductImage,
  ProductQuery,
  VariationDetail,
} from "@/src/types/catalogue";
import { storeApiUrl } from "@/src/config/env";

import { getJson } from "./client";
import type { CatalogueProvider } from "./provider";

// ── raw shapes (only the fields we use) ──────────────────────────────────────
interface RawPrices {
  price: string;
  regular_price: string;
  sale_price: string;
  price_range: { min_amount: string; max_amount: string } | null;
  currency_minor_unit: number;
  currency_symbol: string;
  currency_prefix: string;
  currency_suffix: string;
  currency_decimal_separator: string;
  currency_thousand_separator: string;
}
interface RawImage { id: number; src: string; thumbnail: string; alt: string }
interface RawProduct {
  id: number; parent: number; name: string; slug: string; permalink: string; sku: string;
  type: string; description: string; short_description: string; on_sale: boolean;
  prices: RawPrices; images: RawImage[]; average_rating: string; review_count: number;
  is_in_stock: boolean; is_purchasable: boolean; is_on_backorder: boolean;
  low_stock_remaining: number | null; sold_individually: boolean;
  stock_availability?: { text: string; class: string };
  categories: { id: number; name: string; slug: string }[];
  attributes: { id: number; name: string; taxonomy: string | null; has_variations: boolean;
    terms: { id: number; name: string; slug: string }[] }[];
  variations: { id: number; attributes: { name: string; value: string }[] }[];
  featured?: boolean;
}
interface RawCategory {
  id: number; name: string; slug: string; description: string; parent: number;
  count: number; image: RawImage | null;
}

// ── mappers ──────────────────────────────────────────────────────────────────
const mapPrices = (r: RawPrices): PriceInfo => ({
  price: r.price,
  regularPrice: r.regular_price,
  salePrice: r.sale_price,
  currencyMinorUnit: r.currency_minor_unit,
  currencySymbol: r.currency_symbol,
  currencyPrefix: r.currency_prefix,
  currencySuffix: r.currency_suffix,
  currencyDecimalSeparator: r.currency_decimal_separator,
  currencyThousandSeparator: r.currency_thousand_separator,
  priceRange: r.price_range
    ? { minAmount: r.price_range.min_amount, maxAmount: r.price_range.max_amount }
    : null,
  taxLabel: "incl. VAT",
});

const mapImages = (imgs: RawImage[]): ProductImage[] =>
  (imgs || []).map((i) => ({ id: i.id, src: i.src, thumbnail: i.thumbnail || i.src, alt: i.alt || "" }));

const mapAttributes = (attrs: RawProduct["attributes"]): ProductAttribute[] =>
  (attrs || []).map((a) => ({
    id: a.id,
    name: a.name,
    taxonomy: a.taxonomy,
    hasVariations: a.has_variations,
    terms: (a.terms || []).map((t) => ({ id: t.id, name: t.name, slug: t.slug })),
  }));

function mapProduct(r: RawProduct): Product {
  return {
    id: r.id,
    parentId: r.parent || 0,
    name: r.name,
    slug: r.slug,
    permalink: r.permalink,
    sku: r.sku || "",
    type: r.type === "variable" ? "variable" : "simple",
    shortDescription: r.short_description || "",
    description: r.description || "",
    images: mapImages(r.images),
    prices: mapPrices(r.prices),
    onSale: !!r.on_sale,
    isInStock: !!r.is_in_stock,
    isPurchasable: !!r.is_purchasable,
    isOnBackorder: !!r.is_on_backorder,
    lowStockRemaining: r.low_stock_remaining ?? null,
    soldIndividually: !!r.sold_individually,
    stockText: r.stock_availability?.text || (r.is_in_stock ? "In stock" : "Out of stock"),
    averageRating: r.average_rating || "0",
    reviewCount: r.review_count || 0,
    categories: (r.categories || []).map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    attributes: mapAttributes(r.attributes),
    variations: (r.variations || []).map((v) => ({
      id: v.id,
      attributes: Object.fromEntries((v.attributes || []).map((a) => [a.name, a.value])),
    })),
    featured: !!r.featured,
  };
}

const mapCategory = (r: RawCategory): Category => ({
  id: r.id,
  name: r.name,
  slug: r.slug,
  description: r.description || "",
  count: r.count || 0,
  image: r.image ? { id: r.image.id, src: r.image.src, thumbnail: r.image.thumbnail || r.image.src, alt: r.image.alt || r.name } : null,
  parent: r.parent || 0,
});

function sortParams(sort: ProductQuery["sort"]): string {
  switch (sort) {
    case "newest": return "&orderby=date&order=desc";
    case "price-asc": return "&orderby=price&order=asc";
    case "price-desc": return "&orderby=price&order=desc";
    case "popularity": return "&orderby=popularity&order=desc";
    case "alphabetical": return "&orderby=title&order=asc";
    default: return "&orderby=menu_order&order=asc";
  }
}

export const liveProvider: CatalogueProvider = {
  async getCategories() {
    const { data } = await getJson<RawCategory[]>(
      storeApiUrl("/products/categories?per_page=100&hide_empty=true&orderby=count&order=desc"),
    );
    return data.map(mapCategory);
  },

  async getCategory(idOrSlug) {
    const path = /^\d+$/.test(String(idOrSlug))
      ? `/products/categories/${idOrSlug}`
      : `/products/categories?slug=${encodeURIComponent(String(idOrSlug))}`;
    const { data } = await getJson<RawCategory | RawCategory[]>(storeApiUrl(path));
    const cat = Array.isArray(data) ? data[0] : data;
    return cat ? mapCategory(cat) : null;
  },

  async getProducts(query) {
    const params = [
      `per_page=${query.perPage ?? 12}`,
      `page=${query.page ?? 1}`,
      query.category ? `category=${query.category}` : "",
      query.search ? `search=${encodeURIComponent(query.search)}` : "",
      query.onSale ? "on_sale=true" : "",
      query.inStockOnly ? "stock_status=instock" : "",
      query.minPrice != null ? `min_price=${Math.round(query.minPrice * 100)}` : "",
      query.maxPrice != null ? `max_price=${Math.round(query.maxPrice * 100)}` : "",
      query.orderbyIds?.length ? `include=${query.orderbyIds.join(",")}` : "",
      "catalog_visibility=catalog",
    ].filter(Boolean).join("&");

    const url = storeApiUrl(`/products?${params}${query.orderbyIds?.length ? "" : sortParams(query.sort)}`);
    const { data, total, totalPages } = await getJson<RawProduct[]>(url);
    let items = data.map(mapProduct);
    if (query.orderbyIds?.length) {
      const order = query.orderbyIds;
      items = items.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    return { items, total, totalPages, page: query.page ?? 1 };
  },

  async getProduct(id) {
    const { data } = await getJson<RawProduct>(storeApiUrl(`/products/${id}`));
    return data ? mapProduct(data) : null;
  },

  async getProductsByIds(ids) {
    if (!ids.length) return [];
    const { data } = await getJson<RawProduct[]>(
      storeApiUrl(`/products?include=${ids.join(",")}&per_page=${ids.length}`),
    );
    const items = data.map(mapProduct);
    return ids.map((id) => items.find((p) => p.id === id)).filter((p): p is Product => !!p);
  },

  async getVariationDetails(product): Promise<VariationDetail[]> {
    const results = await Promise.all(
      product.variations.map(async (v) => {
        try {
          const { data } = await getJson<RawProduct>(storeApiUrl(`/products/${v.id}`));
          return {
            id: v.id,
            attributes: v.attributes,
            prices: mapPrices(data.prices),
            isInStock: !!data.is_in_stock,
            isPurchasable: !!data.is_purchasable,
            stockText: data.stock_availability?.text || (data.is_in_stock ? "In stock" : "Out of stock"),
            image: mapImages(data.images)[0] ?? product.images[0] ?? null,
          } as VariationDetail;
        } catch {
          return {
            id: v.id,
            attributes: v.attributes,
            prices: product.prices,
            isInStock: product.isInStock,
            isPurchasable: product.isPurchasable,
            stockText: product.stockText,
            image: product.images[0] ?? null,
          } as VariationDetail;
        }
      }),
    );
    return results;
  },
};
