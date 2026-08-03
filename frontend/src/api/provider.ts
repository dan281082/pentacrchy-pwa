import type {
  Category,
  Paginated,
  Product,
  ProductQuery,
  VariationDetail,
} from "@/src/types/catalogue";

// Contract shared by the mock and live WooCommerce Store API providers.
// The catalogue facade picks one based on EXPO_PUBLIC_DATA_SOURCE.
export interface CatalogueProvider {
  getCategories(): Promise<Category[]>;
  getCategory(idOrSlug: string | number): Promise<Category | null>;
  getProducts(query: ProductQuery): Promise<Paginated<Product>>;
  getProduct(id: string | number): Promise<Product | null>;
  getProductsByIds(ids: number[]): Promise<Product[]>;
  getVariationDetails(product: Product): Promise<VariationDetail[]>;
}
