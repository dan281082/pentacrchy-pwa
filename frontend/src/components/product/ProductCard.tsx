import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Product } from "@/src/types/catalogue";
import { PriceDisplay } from "@/src/components/ui/PriceDisplay";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

import { FavouriteButton } from "./FavouriteButton";

const BLURHASH = "L6Pj0^i_.AyE_3t7t7R**0o#DgR4";

function SaleBadge() {
  return (
    <View style={styles.saleBadge}>
      <Text style={styles.saleText}>SALE</Text>
    </View>
  );
}

function OutOfStockOverlay() {
  return (
    <View style={styles.oosOverlay}>
      <Text style={styles.oosText}>Out of stock</Text>
    </View>
  );
}

// Grid card (2-up). Fixed image aspect for a tidy grid.
export function ProductCard({ product, testID }: { product: Product; testID?: string }) {
  const router = useRouter();
  const image = product.images[0]?.src;
  return (
    <Pressable
      testID={testID ?? `product-card-${product.id}`}
      onPress={() => router.push(`/product/${product.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={product.name}
    >
      <View style={styles.imageWrap}>
        <Image
          source={image}
          placeholder={BLURHASH}
          contentFit="cover"
          transition={200}
          style={styles.image}
          accessibilityLabel={product.images[0]?.alt || product.name}
        />
        {product.onSale && <SaleBadge />}
        {!product.isInStock && <OutOfStockOverlay />}
        <FavouriteButton productId={product.id} style={styles.fav} />
      </View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        <PriceDisplay prices={product.prices} size="sm" showTax={false} />
      </View>
    </Pressable>
  );
}

// List row card (full width).
export function ProductRow({ product, testID }: { product: Product; testID?: string }) {
  const router = useRouter();
  const image = product.images[0]?.src;
  return (
    <Pressable
      testID={testID ?? `product-row-${product.id}`}
      onPress={() => router.push(`/product/${product.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={product.name}
    >
      <View style={styles.rowImageWrap}>
        <Image
          source={image}
          placeholder={BLURHASH}
          contentFit="cover"
          transition={200}
          style={styles.rowImage}
          accessibilityLabel={product.images[0]?.alt || product.name}
        />
        {product.onSale && <SaleBadge />}
        {!product.isInStock && <OutOfStockOverlay />}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.name} numberOfLines={2}>
          {product.name}
        </Text>
        {!!product.sku && <Text style={styles.sku}>{product.sku}</Text>}
        <PriceDisplay prices={product.prices} size="md" showTax={false} />
      </View>
      <FavouriteButton productId={product.id} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { opacity: 0.85 },
  imageWrap: { width: "100%", aspectRatio: 1, backgroundColor: colors.surfaceTertiary },
  image: { width: "100%", height: "100%" },
  fav: { position: "absolute", top: spacing.sm, right: spacing.sm },
  body: { padding: spacing.md, gap: spacing.sm },
  name: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium, lineHeight: 18 },
  sku: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  saleBadge: {
    position: "absolute", top: spacing.sm, left: spacing.sm,
    backgroundColor: colors.brandPrimary, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 2,
  },
  saleText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: fontWeight.medium, letterSpacing: 1 },
  oosOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(18,18,20,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  oosText: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    padding: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  rowImageWrap: {
    width: 88, height: 88, borderRadius: radius.sm, overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
  },
  rowImage: { width: "100%", height: "100%" },
  rowBody: { flex: 1, gap: spacing.xs },
});
