import { Image } from "expo-image";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PriceDisplay } from "@/src/components/ui/PriceDisplay";
import { StockBadge } from "@/src/components/ui/StockBadge";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { ProductCardSkeleton } from "@/src/components/ui/Skeleton";
import { TopBar } from "@/src/components/ui/TopBar";
import { useProductsByIds } from "@/src/hooks/use-catalogue";
import { useBasketStore } from "@/src/store/basket-store";
import { useFavouritesStore } from "@/src/store/favourites-store";
import type { Product } from "@/src/types/catalogue";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

const BLURHASH = "L6Pj0^i_.AyE_3t7t7R**0o#DgR4";

function FavouriteRow({ product }: { product: Product }) {
  const router = useRouter();
  const remove = useFavouritesStore((s) => s.remove);
  const addItem = useBasketStore((s) => s.addItem);
  const isVariable = product.type === "variable";
  const canAdd = product.isPurchasable && product.isInStock && !isVariable;

  return (
    <View style={styles.row} testID={`favourite-row-${product.id}`}>
      <Pressable onPress={() => router.push(`/product/${product.id}`)} style={styles.imageWrap}>
        <Image source={product.images[0]?.src} placeholder={BLURHASH} contentFit="cover" style={styles.image} />
        {!product.isInStock && (
          <View style={styles.oos}><Text style={styles.oosText}>Out of stock</Text></View>
        )}
      </Pressable>
      <View style={styles.info}>
        <Pressable onPress={() => router.push(`/product/${product.id}`)}>
          <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        </Pressable>
        <PriceDisplay prices={product.prices} size="sm" showTax={false} />
        <StockBadge inStock={product.isInStock} text={product.stockText} onBackorder={product.isOnBackorder} lowStockRemaining={product.lowStockRemaining} />
        <View style={styles.actions}>
          <Pressable
            testID={`fav-add-${product.id}`}
            onPress={() => {
              if (isVariable) { router.push(`/product/${product.id}`); return; }
              addItem(product, 1, null);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            }}
            disabled={!canAdd && !isVariable}
            style={[styles.addBtn, !canAdd && !isVariable && styles.addBtnDisabled]}
          >
            <Ionicons name={isVariable ? "options-outline" : "bag-add-outline"} size={16} color={colors.onBrandPrimary} />
            <Text style={styles.addText}>{isVariable ? "Choose options" : "Add to basket"}</Text>
          </Pressable>
          <Pressable testID={`fav-remove-${product.id}`} onPress={() => remove(product.id)} hitSlop={8} style={styles.removeBtn}>
            <Ionicons name="heart-dislike-outline" size={20} color={colors.onSurfaceTertiary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function FavouritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ids = useFavouritesStore((s) => s.ids);
  const query = useProductsByIds(ids);

  return (
    <View style={styles.container} testID="favourites-screen">
      <TopBar title="Favourites" showBack />
      {ids.length === 0 ? (
        <EmptyState
          testID="favourites-empty"
          icon="heart-outline"
          title="No favourites yet"
          message="Tap the heart on any product to save it here."
          actionLabel="Start shopping"
          onAction={() => router.replace("/(tabs)/shop")}
        />
      ) : query.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => <ProductCardSkeleton key={i} />)}
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(p) => String(p.id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          renderItem={({ item }) => <FavouriteRow product={item} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  row: {
    flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  imageWrap: { width: 96, height: 96, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  image: { width: "100%", height: "100%" },
  oos: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(18,18,20,0.55)", alignItems: "center", justifyContent: "center" },
  oosText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  info: { flex: 1, gap: spacing.xs },
  name: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  actions: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.xs },
  addBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: spacing.xs,
    backgroundColor: colors.brandPrimary, borderRadius: radius.sm, paddingVertical: spacing.sm,
  },
  addBtnDisabled: { opacity: 0.4 },
  addText: { color: colors.onBrandPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  removeBtn: { width: 40, height: 36, alignItems: "center", justifyContent: "center" },
});
