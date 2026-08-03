import { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCard, ProductRow } from "@/src/components/product/ProductCard";
import { SortSheet, sortLabel } from "@/src/components/product/SortSheet";
import { Chip } from "@/src/components/ui/Chip";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { ProductCardSkeleton } from "@/src/components/ui/Skeleton";
import { useCategories, useInfiniteProducts } from "@/src/hooks/use-catalogue";
import type { Category, Product, SortOption } from "@/src/types/catalogue";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

type ViewMode = "grid" | "list";

export function ProductListing({
  lockedCategoryId,
  initialSort = "recommended",
  headerExtra,
  testID = "product-listing",
}: {
  lockedCategoryId?: number; // category screen: fixed category, no category chips
  initialSort?: SortOption;
  headerExtra?: React.ReactNode;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const sortRef = useRef<BottomSheetModal>(null);

  const [sort, setSort] = useState<SortOption>(initialSort);
  const [categoryId, setCategoryId] = useState<number | undefined>(lockedCategoryId);
  const [onSale, setOnSale] = useState(false);
  const [inStock, setInStock] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const showCategoryChips = lockedCategoryId == null;
  const categories = useCategories();

  const query = {
    category: lockedCategoryId ?? categoryId,
    sort,
    onSale: onSale || undefined,
    inStockOnly: inStock || undefined,
    perPage: 8,
  };

  const products = useInfiniteProducts(query);
  const items: Product[] = products.data?.pages.flatMap((p) => p.items) ?? [];
  const total = products.data?.pages[0]?.total ?? 0;

  const activeFilterCount = (onSale ? 1 : 0) + (inStock ? 1 : 0) + (categoryId ? 1 : 0);

  const clearFilters = () => {
    setOnSale(false);
    setInStock(false);
    if (showCategoryChips) setCategoryId(undefined);
  };

  return (
    <View style={styles.container} testID={testID}>
      {headerExtra}

      {/* Sticky controls: view toggle + sort + result count */}
      <View style={styles.controls}>
        <Text style={styles.count}>
          {products.isLoading ? "Loading…" : `${total} product${total === 1 ? "" : "s"}`}
        </Text>
        <View style={styles.controlBtns}>
          <Pressable
            testID="sort-button"
            onPress={() => sortRef.current?.present()}
            style={styles.controlBtn}
            accessibilityRole="button"
            accessibilityLabel={`Sort by ${sortLabel(sort)}`}
          >
            <Ionicons name="swap-vertical" size={16} color={colors.onSurface} />
            <Text style={styles.controlBtnText} numberOfLines={1}>{sortLabel(sort)}</Text>
          </Pressable>
          <Pressable
            testID="view-toggle-button"
            onPress={() => setViewMode((m) => (m === "grid" ? "list" : "grid"))}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={viewMode === "grid" ? "Switch to list view" : "Switch to grid view"}
          >
            <Ionicons name={viewMode === "grid" ? "list" : "grid"} size={18} color={colors.onSurface} />
          </Pressable>
        </View>
      </View>

      {/* Filter / category chip row — single horizontal scroller (chrome) */}
      <View style={styles.chipRowWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <Chip label="On sale" icon="pricetag" selected={onSale} onPress={() => setOnSale((v) => !v)} testID="filter-chip-sale" />
          <Chip label="In stock" icon="checkmark-circle" selected={inStock} onPress={() => setInStock((v) => !v)} testID="filter-chip-instock" />
          {showCategoryChips && (
            <>
              <View style={styles.chipDivider} />
              <Chip
                label="All"
                selected={categoryId == null}
                onPress={() => setCategoryId(undefined)}
                testID="filter-chip-all"
              />
              {(categories.data ?? []).map((c: Category) => (
                <Chip
                  key={c.id}
                  label={c.name}
                  selected={categoryId === c.id}
                  onPress={() => setCategoryId(c.id)}
                  testID={`filter-chip-cat-${c.id}`}
                />
              ))}
            </>
          )}
        </ScrollView>
      </View>

      {/* Body */}
      {products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : products.isLoading ? (
        <FlatList
          key="grid-skeleton"
          data={[0, 1, 2, 3, 4, 5]}
          keyExtractor={(i) => String(i)}
          numColumns={2}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.listContent}
          renderItem={() => <View style={styles.gridCell}><ProductCardSkeleton /></View>}
        />
      ) : items.length === 0 ? (
        <EmptyState
          testID="listing-empty"
          icon="cube-outline"
          title="No products found"
          message={activeFilterCount > 0 ? "Try adjusting your filters." : "Nothing here yet."}
          actionLabel={activeFilterCount > 0 ? "Clear filters" : undefined}
          onAction={activeFilterCount > 0 ? clearFilters : undefined}
        />
      ) : (
        <FlatList
          key={viewMode}
          data={items}
          keyExtractor={(p) => String(p.id)}
          numColumns={viewMode === "grid" ? 2 : 1}
          columnWrapperStyle={viewMode === "grid" ? styles.column : undefined}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + spacing["2xl"] }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={products.isRefetching && !products.isFetchingNextPage}
              onRefresh={() => products.refetch()}
              tintColor={colors.brandSecondary}
            />
          }
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (products.hasNextPage && !products.isFetchingNextPage) products.fetchNextPage();
          }}
          ListFooterComponent={
            products.isFetchingNextPage ? (
              <ActivityIndicator style={{ paddingVertical: spacing.lg }} color={colors.brandSecondary} />
            ) : null
          }
          renderItem={({ item }) =>
            viewMode === "grid" ? (
              <View style={styles.gridCell}>
                <ProductCard product={item} />
              </View>
            ) : (
              <View style={styles.listCell}>
                <ProductRow product={item} />
              </View>
            )
          }
        />
      )}

      <SortSheet
        ref={sortRef}
        value={sort}
        onSelect={(v) => {
          setSort(v);
          sortRef.current?.dismiss();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  controls: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm,
  },
  count: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  controlBtns: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  controlBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.xs,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, height: 36, maxWidth: 180,
  },
  controlBtnText: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  chipRowWrap: { height: 56, justifyContent: "center" },
  chipRow: { paddingHorizontal: spacing.lg, gap: spacing.sm, alignItems: "center" },
  chipDivider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: spacing.xs },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.md },
  column: { gap: spacing.md },
  gridCell: { flex: 1, maxWidth: "50%" },
  listCell: {},
});
