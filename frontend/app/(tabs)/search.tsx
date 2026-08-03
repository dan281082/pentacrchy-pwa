import { useState } from "react";
import {
  FlatList,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductRow } from "@/src/components/product/ProductCard";
import { Chip } from "@/src/components/ui/Chip";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { ProductCardSkeleton } from "@/src/components/ui/Skeleton";
import { useCategories, useProducts } from "@/src/hooks/use-catalogue";
import { useDebounce } from "@/src/hooks/use-debounce";
import { useHistoryStore } from "@/src/store/history-store";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query.trim(), 350);
  const active = debounced.length >= 2;

  const results = useProducts(active ? { search: debounced, perPage: 20 } : {});
  const categories = useCategories();

  const recent = useHistoryStore((s) => s.recentSearches);
  const pushSearch = useHistoryStore((s) => s.pushSearch);
  const removeSearch = useHistoryStore((s) => s.removeSearch);
  const clearSearches = useHistoryStore((s) => s.clearSearches);

  const submit = (term: string) => {
    const t = term.trim();
    if (t.length >= 2) {
      setQuery(t);
      pushSearch(t);
      Keyboard.dismiss();
    }
  };

  const items = active ? results.data?.items ?? [] : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="search-screen">
      {/* Search bar */}
      <View style={styles.header}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={colors.onSurfaceTertiary} />
          <TextInput
            testID="search-input"
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => submit(query)}
            placeholder="Search products, SKU, category"
            placeholderTextColor={colors.onSurfaceTertiary}
            style={styles.input}
            returnKeyType="search"
            autoCorrect={false}
            accessibilityLabel="Search products"
          />
          {query.length > 0 && (
            <Pressable testID="search-clear" onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color={colors.onSurfaceTertiary} />
            </Pressable>
          )}
        </View>
      </View>

      {!active ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        >
          {recent.length > 0 && (
            <View style={styles.block}>
              <View style={styles.blockHeader}>
                <Text style={styles.blockTitle}>Recent searches</Text>
                <Pressable testID="clear-recent-searches" onPress={clearSearches} hitSlop={8}>
                  <Text style={styles.clearAll}>Clear</Text>
                </Pressable>
              </View>
              {recent.map((term) => (
                <Pressable
                  key={term}
                  testID={`recent-search-${term}`}
                  onPress={() => submit(term)}
                  style={styles.recentRow}
                >
                  <Ionicons name="time-outline" size={18} color={colors.onSurfaceTertiary} />
                  <Text style={styles.recentText}>{term}</Text>
                  <Pressable onPress={() => removeSearch(term)} hitSlop={8} accessibilityLabel={`Remove ${term}`}>
                    <Ionicons name="close" size={16} color={colors.onSurfaceTertiary} />
                  </Pressable>
                </Pressable>
              ))}
            </View>
          )}

          <View style={styles.block}>
            <Text style={styles.blockTitle}>Browse categories</Text>
            <View style={styles.suggestions}>
              {(categories.data ?? []).map((c) => (
                <Chip key={c.id} label={c.name} onPress={() => submit(c.name)} testID={`suggestion-${c.id}`} />
              ))}
            </View>
          </View>
        </ScrollView>
      ) : results.isError ? (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      ) : results.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2, 3].map((i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </View>
      ) : items.length === 0 ? (
        <EmptyState
          testID="search-empty"
          icon="search-outline"
          title="No results"
          message={`We couldn’t find anything for “${debounced}”.`}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => String(p.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          renderItem={({ item }) => <ProductRow product={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md, height: 48,
  },
  input: { flex: 1, color: colors.onSurface, fontSize: fontSize.lg, paddingVertical: 0 },
  block: { marginBottom: spacing.xl },
  blockHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
  blockTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  clearAll: { color: colors.brandSecondary, fontSize: fontSize.base },
  recentRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  recentText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: fontSize.base },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
});
