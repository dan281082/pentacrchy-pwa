// Mock catalogue provider — filters/sorts/paginates the local dataset and
// mirrors the live provider's contract exactly. Adds a small artificial delay
// so loading skeletons are exercised.

import type {
  Category,
  Paginated,
  Product,
  ProductQuery,
  VariationDetail,
} from "@/src/types/catalogue";
import { toMinor } from "@/src/utils/format";

import { MOCK_CATEGORIES, MOCK_PRODUCTS, MOCK_VARIATION_DETAILS } from "./data";
import type { CatalogueProvider } from "../provider";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function priceValue(p: Product): number {
  const src = p.prices.priceRange ? p.prices.priceRange.minAmount : p.prices.price;
  return parseInt(src, 10) || 0;
}

function sortProducts(list: Product[], sort: ProductQuery["sort"]): Product[] {
  const arr = [...list];
  switch (sort) {
    case "price-asc":
      return arr.sort((a, b) => priceValue(a) - priceValue(b));
    case "price-desc":
      return arr.sort((a, b) => priceValue(b) - priceValue(a));
    case "alphabetical":
      return arr.sort((a, b) => a.name.localeCompare(b.name));
    case "newest":
      return arr.sort((a, b) => b.id - a.id);
    case "popularity":
      return arr.sort((a, b) => b.reviewCount - a.reviewCount);
    default:
      return arr;
  }
}

export const mockProvider: CatalogueProvider = {
  async getCategories() {
    await delay(300);
    return MOCK_CATEGORIES;
  },

  async getCategory(idOrSlug) {
    await delay(200);
    return (
      MOCK_CATEGORIES.find(
        (c) => String(c.id) === String(idOrSlug) || c.slug === String(idOrSlug),
      ) ?? null
    );
  },

  async getProducts(query: ProductQuery): Promise<Paginated<Product>> {
    await delay(400);
    let list = [...MOCK_PRODUCTS];

    if (query.category) list = list.filter((p) => p.categories.some((c) => c.id === query.category));
    if (query.featured) list = list.filter((p) => p.featured);
    if (query.onSale) list = list.filter((p) => p.onSale);
    if (query.inStockOnly) list = list.filter((p) => p.isInStock);
    if (query.search) {
      const q = query.search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          p.categories.some((c) => c.name.toLowerCase().includes(q)),
      );
    }
    if (query.minPrice != null) list = list.filter((p) => priceValue(p) >= toMinor(query.minPrice!));
    if (query.maxPrice != null) list = list.filter((p) => priceValue(p) <= toMinor(query.maxPrice!));

    if (query.orderbyIds && query.orderbyIds.length) {
      const order = query.orderbyIds;
      list = list
        .filter((p) => order.includes(p.id))
        .sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    } else {
      list = sortProducts(list, query.sort ?? "recommended");
    }

    const perPage = query.perPage ?? 12;
    const page = query.page ?? 1;
    const total = list.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const items = list.slice((page - 1) * perPage, page * perPage);
    return { items, total, totalPages, page };
  },

  async getProduct(id) {
    await delay(300);
    return MOCK_PRODUCTS.find((p) => p.id === Number(id)) ?? null;
  },

  async getProductsByIds(ids) {
    await delay(250);
    const map = new Map(MOCK_PRODUCTS.map((p) => [p.id, p]));
    return ids.map((id) => map.get(id)).filter((p): p is Product => !!p);
  },

  async getVariationDetails(product): Promise<VariationDetail[]> {
    await delay(200);
    return product.variations.map((v) => {
      const d = (MOCK_VARIATION_DETAILS as any)[v.id];
      return {
        id: v.id,
        attributes: v.attributes,
        prices: d?.prices ?? product.prices,
        isInStock: d?.isInStock ?? true,
        isPurchasable: d?.isInStock ?? true,
        stockText: d?.stockText ?? "In stock",
        image: product.images[0] ?? null,
      };
    });
  },
};
