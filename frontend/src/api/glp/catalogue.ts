// GLP catalogue provider — maps the GLP connector's product/category payloads
// into the app's normalised domain model so every existing screen works
// unchanged. WooCommerce stays the source of truth: we format `price` but never
// recalculate it, and surface stock status/quantity verbatim.

import type {
  Category,
  Paginated,
  Product,
  ProductAttribute,
  ProductQuery,
  PriceInfo,
  ProductImage,
  VariationDetail,
  VariationRef,
} from "@/src/types/catalogue";

import type { CatalogueProvider } from "../provider";
import { glpFetch } from "./client";
import { mapCoa } from "./coa";

const GBP = (minor: string): PriceInfo => ({
  price: minor,
  regularPrice: minor,
  salePrice: minor,
  currencyMinorUnit: 2,
  currencySymbol: "£",
  currencyPrefix: "£",
  currencySuffix: "",
  currencyDecimalSeparator: ".",
  currencyThousandSeparator: ",",
  priceRange: null,
  taxLabel: "incl. VAT",
});

const minor = (price: unknown): string => String(Math.round((Number(price) || 0) * 100));

function stockText(status: string, count: unknown): string {
  if (status === "out_of_stock") return "Out of stock";
  if (status === "low_stock") {
    const n = Number(count);
    return Number.isFinite(n) && n > 0 ? `Only ${n} left` : "Low stock";
  }
  return "In stock";
}

function image(url: unknown, name: string): ProductImage[] {
  const src = typeof url === "string" && url ? url : "";
  return src ? [{ id: 0, src, thumbnail: src, alt: name }] : [];
}

function mapProduct(p: any): Product {
  const name = String(p?.name ?? "");
  const status = String(p?.stock_status ?? "in_stock");
  const inStock = status !== "out_of_stock";
  const count = p?.stock_count == null ? null : Number(p.stock_count);

  const attributes: ProductAttribute[] = Array.isArray(p?.attributes)
    ? p.attributes.map((a: any, i: number) => ({
        id: i,
        name: String(a?.name ?? ""),
        taxonomy: null,
        hasVariations: true,
        terms: (Array.isArray(a?.options) ? a.options : []).map((o: string, j: number) => ({
          id: j,
          name: String(o),
          slug: String(o),
        })),
      }))
    : [];

  const variations: VariationRef[] = Array.isArray(p?.variations)
    ? p.variations.map((v: any) => ({
        id: Number(v?.variation_id ?? v?.id ?? 0),
        attributes: (v?.attributes ?? {}) as Record<string, string>,
      }))
    : [];

  return {
    id: Number(p?.id ?? 0),
    parentId: 0,
    name,
    slug: String(p?.slug ?? p?.id ?? ""),
    permalink: "",
    sku: String(p?.sku ?? ""),
    type: p?.type === "variable" ? "variable" : "simple",
    shortDescription: "",
    description: String(p?.description ?? ""),
    images: image(p?.image_url, name),
    prices: GBP(minor(p?.price)),
    onSale: false,
    isInStock: inStock,
    isPurchasable: inStock,
    isOnBackorder: false,
    lowStockRemaining: status === "low_stock" ? count : count,
    soldIndividually: false,
    stockText: stockText(status, count),
    averageRating: "0",
    reviewCount: 0,
    categories: p?.category_id
      ? [{ id: Number(p.category_id), name: String(p?.category ?? ""), slug: String(p.category_id) }]
      : [],
    attributes,
    variations,
    featured: false,
    coa: mapCoa(p?.coa),
  };
}

function mapVariationDetail(v: any): VariationDetail {
  const status = String(v?.stock_status ?? "in_stock");
  const inStock = status !== "out_of_stock";
  return {
    id: Number(v?.variation_id ?? v?.id ?? 0),
    attributes: (v?.attributes ?? {}) as Record<string, string>,
    prices: GBP(minor(v?.price)),
    isInStock: inStock,
    isPurchasable: Boolean(v?.purchasable ?? inStock),
    stockText: stockText(status, v?.stock_count),
    image:
      typeof v?.image_url === "string" && v.image_url
        ? { id: 0, src: v.image_url, thumbnail: v.image_url, alt: "" }
        : null,
  };
}

function sortProducts(items: Product[], sort?: string): Product[] {
  const by = [...items];
  if (sort === "price-asc") by.sort((a, b) => Number(a.prices.price) - Number(b.prices.price));
  else if (sort === "price-desc") by.sort((a, b) => Number(b.prices.price) - Number(a.prices.price));
  else if (sort === "alphabetical") by.sort((a, b) => a.name.localeCompare(b.name));
  return by;
}

let _cache: Product[] | null = null;
async function allProducts(): Promise<Product[]> {
  const raw = await glpFetch<any>("/catalogue");
  const list = Array.isArray(raw?.products) ? raw.products : (raw?.items ?? []);
  _cache = list.map(mapProduct);
  return _cache!;
}

export const glpCatalogueProvider: CatalogueProvider = {
  async getCategories() {
    const raw = await glpFetch<any>("/categories");
    const list = Array.isArray(raw?.categories) ? raw.categories : [];
    return list.map(
      (c: any): Category => ({
        id: Number(c?.id ?? 0),
        name: String(c?.name ?? ""),
        slug: String(c?.slug ?? c?.id ?? ""),
        description: "",
        count: Number(c?.count ?? 0),
        image: null,
        parent: 0,
      }),
    );
  },

  async getCategory(idOrSlug) {
    const cats = await this.getCategories();
    return (
      cats.find((c) => String(c.id) === String(idOrSlug) || c.slug === String(idOrSlug)) ?? null
    );
  },

  async getProducts(query: ProductQuery) {
    let items = await allProducts();
    if (query.category) items = items.filter((p) => p.categories.some((c) => c.id === query.category));
    if (query.search) {
      const q = query.search.toLowerCase();
      items = items.filter((p) => p.name.toLowerCase().includes(q));
    }
    if (query.inStockOnly) items = items.filter((p) => p.isInStock);
    items = sortProducts(items, query.sort);

    const page = query.page ?? 1;
    const perPage = query.perPage ?? 20;
    const start = (page - 1) * perPage;
    const paged = items.slice(start, start + perPage);
    return {
      items: paged,
      total: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / perPage)),
      page,
    } as Paginated<Product>;
  },

  async getProduct(id) {
    const raw = await glpFetch<any>(`/products/${id}`);
    const p = raw?.product ?? raw;
    return p ? mapProduct(p) : null;
  },

  async getProductsByIds(ids) {
    if (!ids.length) return [];
    const all = _cache ?? (await allProducts());
    const map = new Map(all.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter((p): p is Product => !!p);
  },

  async getVariationDetails(product) {
    const raw = await glpFetch<any>(`/products/${product.id}`);
    const p = raw?.product ?? raw;
    const vars = Array.isArray(p?.variations) ? p.variations : [];
    return vars.map(mapVariationDetail);
  },
};
