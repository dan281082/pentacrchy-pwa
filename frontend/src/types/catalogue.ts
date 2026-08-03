// ── Normalised domain model ─────────────────────────────────────────────────
// Screens ONLY consume these types. Both the mock provider and the live
// WooCommerce Store API provider map their raw responses into these shapes, so
// the UI never cares which source is active.
//
// IMPORTANT: prices are kept exactly as WooCommerce returns them (integer minor
// units + currency metadata). The app formats but NEVER recalculates them —
// WooCommerce remains the single source of truth for price, sale, VAT & totals.

export interface PriceInfo {
  price: string; // final display price (incl. VAT per store settings), minor units
  regularPrice: string;
  salePrice: string;
  currencyMinorUnit: number;
  currencySymbol: string;
  currencyPrefix: string;
  currencySuffix: string;
  currencyDecimalSeparator: string;
  currencyThousandSeparator: string;
  priceRange: { minAmount: string; maxAmount: string } | null;
  // WooCommerce-provided VAT label context, shown verbatim (e.g. "incl. VAT").
  taxLabel: string;
}

export interface ProductImage {
  id: number;
  src: string;
  thumbnail: string;
  alt: string;
}

export interface CategoryRef {
  id: number;
  name: string;
  slug: string;
}

export interface AttributeTerm {
  id: number;
  name: string;
  slug: string;
}

export interface ProductAttribute {
  id: number;
  name: string;
  taxonomy: string | null;
  hasVariations: boolean;
  terms: AttributeTerm[];
}

export interface VariationRef {
  id: number;
  // attribute name -> selected value (e.g. { "Size": "Large" })
  attributes: Record<string, string>;
}

export interface VariationDetail {
  id: number;
  attributes: Record<string, string>;
  prices: PriceInfo;
  isInStock: boolean;
  isPurchasable: boolean;
  stockText: string;
  image: ProductImage | null;
}

export type ProductType = "simple" | "variable";

export interface Product {
  id: number;
  parentId: number;
  name: string;
  slug: string;
  permalink: string;
  sku: string;
  type: ProductType;
  shortDescription: string; // raw HTML from WooCommerce
  description: string; // raw HTML from WooCommerce
  images: ProductImage[];
  prices: PriceInfo;
  onSale: boolean;
  isInStock: boolean;
  isPurchasable: boolean;
  isOnBackorder: boolean;
  lowStockRemaining: number | null;
  soldIndividually: boolean;
  stockText: string;
  averageRating: string;
  reviewCount: number;
  categories: CategoryRef[];
  attributes: ProductAttribute[];
  variations: VariationRef[];
  featured: boolean;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string;
  count: number;
  image: ProductImage | null;
  parent: number;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  totalPages: number;
  page: number;
}

export type SortOption =
  | "recommended"
  | "newest"
  | "price-asc"
  | "price-desc"
  | "popularity"
  | "alphabetical";

export interface ProductQuery {
  page?: number;
  perPage?: number;
  category?: number;
  search?: string;
  sort?: SortOption;
  onSale?: boolean;
  inStockOnly?: boolean;
  minPrice?: number; // major units
  maxPrice?: number; // major units
  featured?: boolean;
  orderbyIds?: number[]; // preserve a specific order (e.g. reorder / recently viewed)
}
