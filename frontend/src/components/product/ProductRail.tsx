import { FlatList, StyleSheet, View } from "react-native";

import type { Product } from "@/src/types/catalogue";
import { SectionHeader } from "@/src/components/ui/SectionHeader";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { spacing, radius } from "@/src/theme";

import { ProductCard } from "./ProductCard";

const CARD_WIDTH = 160;

// Horizontal product rail used across Home (Featured / New / etc.).
export function ProductRail({
  title,
  products,
  loading,
  onSeeAll,
  testID,
}: {
  title: string;
  products: Product[];
  loading?: boolean;
  onSeeAll?: () => void;
  testID?: string;
}) {
  if (!loading && products.length === 0) return null;

  return (
    <View style={styles.wrap} testID={testID}>
      <SectionHeader title={title} actionLabel={onSeeAll ? "See all" : undefined} onAction={onSeeAll} testID={testID ? `${testID}-header` : undefined} />
      {loading ? (
        <View style={styles.loadingRow}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ width: CARD_WIDTH }}>
              <Skeleton height={CARD_WIDTH} rounded={radius.md} />
              <Skeleton width="80%" height={12} style={{ marginTop: 8 }} />
              <Skeleton width="50%" height={12} style={{ marginTop: 6 }} />
            </View>
          ))}
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => String(p.id)}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <View style={{ width: CARD_WIDTH }}>
              <ProductCard product={item} testID={`rail-card-${item.id}`} />
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.xl },
  listContent: { paddingHorizontal: spacing.lg, gap: spacing.md },
  loadingRow: { flexDirection: "row", gap: spacing.md, paddingHorizontal: spacing.lg },
});
