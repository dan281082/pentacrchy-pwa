// TanStack Query hooks over the catalogue facade. Query keys are stable so
// caching, cancellation and refetch behave predictably.

import {
  useInfiniteQuery,
  useQuery,
  keepPreviousData,
} from "@tanstack/react-query";

import { catalogue } from "@/src/api/catalogue";
import type { Product, ProductQuery } from "@/src/types/catalogue";

export const qk = {
  categories: ["categories"] as const,
  category: (id: string | number) => ["category", String(id)] as const,
  products: (q: ProductQuery) => ["products", q] as const,
  productsInfinite: (q: ProductQuery) => ["products-infinite", q] as const,
  product: (id: string | number) => ["product", String(id)] as const,
  byIds: (ids: number[]) => ["products-by-ids", ids] as const,
  variations: (id: number) => ["variations", id] as const,
};

export function useCategories() {
  return useQuery({ queryKey: qk.categories, queryFn: () => catalogue.getCategories() });
}

export function useCategory(idOrSlug: string | number) {
  return useQuery({
    queryKey: qk.category(idOrSlug),
    queryFn: () => catalogue.getCategory(idOrSlug),
    enabled: !!idOrSlug,
  });
}

export function useProducts(query: ProductQuery) {
  return useQuery({
    queryKey: qk.products(query),
    queryFn: () => catalogue.getProducts(query),
    placeholderData: keepPreviousData,
  });
}

export function useInfiniteProducts(query: ProductQuery) {
  return useInfiniteQuery({
    queryKey: qk.productsInfinite(query),
    initialPageParam: 1,
    queryFn: ({ pageParam }) => catalogue.getProducts({ ...query, page: pageParam }),
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useProduct(id: string | number) {
  return useQuery({
    queryKey: qk.product(id),
    queryFn: () => catalogue.getProduct(id),
    enabled: !!id,
    staleTime: 0, // always show live WooCommerce stock on the product page
  });
}

export function useProductsByIds(ids: number[]) {
  return useQuery({
    queryKey: qk.byIds(ids),
    queryFn: () => catalogue.getProductsByIds(ids),
    enabled: ids.length > 0,
  });
}

export function useVariationDetails(product: Product | null | undefined) {
  return useQuery({
    queryKey: qk.variations(product?.id ?? 0),
    queryFn: () => catalogue.getVariationDetails(product!),
    enabled: !!product && product.type === "variable",
  });
}
