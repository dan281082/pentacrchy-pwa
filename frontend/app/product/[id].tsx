import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FavouriteButton } from "@/src/components/product/FavouriteButton";
import { ProductRail } from "@/src/components/product/ProductRail";
import { Button } from "@/src/components/ui/Button";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { PriceDisplay } from "@/src/components/ui/PriceDisplay";
import { QuantityStepper } from "@/src/components/ui/QuantityStepper";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { StockBadge } from "@/src/components/ui/StockBadge";
import { TopBar } from "@/src/components/ui/TopBar";
import { env } from "@/src/config/env";
import { useProduct, useProducts, useVariationDetails } from "@/src/hooks/use-catalogue";
import { useBasketStore } from "@/src/store/basket-store";
import { useHistoryStore } from "@/src/store/history-store";
import type { PriceInfo } from "@/src/types/catalogue";
import { stripHtml } from "@/src/utils/html";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const BLURHASH = "L6Pj0^i_.AyE_3t7t7R**0o#DgR4";

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const productQuery = useProduct(id);
  const product = productQuery.data;

  const variationsQuery = useVariationDetails(product);
  const pushViewed = useHistoryStore((s) => s.pushViewed);
  const addItem = useBasketStore((s) => s.addItem);

  const [gallery, setGallery] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [descOpen, setDescOpen] = useState(false);
  const [zoom, setZoom] = useState<string | null>(null);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (product) pushViewed(product.id);
  }, [product, pushViewed]);

  const variationAttrs = useMemo(
    () => (product?.attributes ?? []).filter((a) => a.hasVariations),
    [product],
  );
  const allSelected = variationAttrs.every((a) => selected[a.name]);
  const matched = variationsQuery.data?.find((v) =>
    variationAttrs.every((a) => v.attributes[a.name] === selected[a.name]),
  );

  const related = useProducts(
    product ? { category: product.categories[0]?.id, perPage: 10 } : {},
  );

  if (productQuery.isLoading) {
    return (
      <View style={styles.container} testID="product-screen-loading">
        <TopBar showBack />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton height={SCREEN_W * 0.8} rounded={radius.lg} />
          <Skeleton width="70%" height={22} />
          <Skeleton width="40%" height={18} />
          <Skeleton width="100%" height={60} />
        </View>
      </View>
    );
  }

  if (productQuery.isError || !product) {
    return (
      <View style={styles.container}>
        <TopBar showBack />
        <ErrorState
          error={productQuery.error}
          title="Product unavailable"
          onRetry={() => productQuery.refetch()}
        />
      </View>
    );
  }

  const isVariable = product.type === "variable";
  const activePrices: PriceInfo = matched?.prices ?? product.prices;
  const activeInStock = isVariable ? (matched ? matched.isInStock : product.isInStock) : product.isInStock;
  const activeStockText = matched?.stockText ?? product.stockText;
  const canAdd = product.isPurchasable && (isVariable ? !!(allSelected && matched?.isInStock) : product.isInStock);

  const relatedItems = (related.data?.items ?? []).filter((p) => p.id !== product.id);

  const onAdd = () => {
    addItem(product, quantity, isVariable ? matched : null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setToast(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(false), 2000);
  };

  return (
    <View style={styles.container} testID="product-screen">
      <TopBar showBack title={product.name} showBasket />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        {/* Gallery */}
        <View style={styles.galleryWrap}>
          {product.images.length > 0 ? (
            <FlatList
              data={product.images}
              keyExtractor={(img, i) => `${img.id}-${i}`}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) =>
                setGallery(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))
              }
              renderItem={({ item }) => (
                <Pressable testID="product-gallery-image" onPress={() => setZoom(item.src)}>
                  <Image
                    source={item.src}
                    placeholder={BLURHASH}
                    contentFit="cover"
                    transition={200}
                    style={{ width: SCREEN_W, height: SCREEN_W }}
                    accessibilityLabel={item.alt || product.name}
                  />
                </Pressable>
              )}
            />
          ) : (
            <View style={[styles.noImage, { width: SCREEN_W, height: SCREEN_W }]}>
              <Ionicons name="image-outline" size={48} color={colors.onSurfaceTertiary} />
            </View>
          )}
          {product.onSale && (
            <View style={styles.saleBadge}>
              <Text style={styles.saleText}>SALE</Text>
            </View>
          )}
          {product.images.length > 1 && (
            <View style={styles.dots}>
              {product.images.map((_, i) => (
                <View key={i} style={[styles.dot, i === gallery && styles.dotActive]} />
              ))}
            </View>
          )}
        </View>

        <View style={styles.body}>
          {!!product.categories[0] && (
            <Text style={styles.category}>{product.categories[0].name}</Text>
          )}
          <Text style={styles.title}>{product.name}</Text>

          <PriceDisplay prices={activePrices} size="lg" testID="product-price" />

          <View style={styles.stockRow}>
            <StockBadge
              inStock={activeInStock}
              onBackorder={product.isOnBackorder}
              lowStockRemaining={product.lowStockRemaining}
              text={activeStockText}
              testID="product-stock-badge"
            />
            {!!product.sku && <Text style={styles.sku}>SKU: {product.sku}</Text>}
          </View>

          {!!stripHtml(product.shortDescription) && (
            <Text style={styles.shortDesc}>{stripHtml(product.shortDescription)}</Text>
          )}

          {/* Variation selectors */}
          {variationAttrs.map((attr) => (
            <View key={attr.id} style={styles.variationBlock} testID={`variation-${attr.name}`}>
              <Text style={styles.variationLabel}>{attr.name}</Text>
              <View style={styles.pills}>
                {attr.terms.map((term) => {
                  const isSel = selected[attr.name] === term.name;
                  return (
                    <Pressable
                      key={term.id}
                      testID={`variation-option-${attr.name}-${term.slug}`}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        setSelected((s) => ({ ...s, [attr.name]: term.name }));
                      }}
                      style={[styles.pill, isSel && styles.pillSelected]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSel }}
                    >
                      <Text style={[styles.pillText, isSel && styles.pillTextSelected]}>
                        {term.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {isVariable && !allSelected && (
            <Text style={styles.hint}>Select options to add to basket.</Text>
          )}

          {/* Quantity */}
          {!product.soldIndividually && (
            <View style={styles.qtyBlock}>
              <Text style={styles.variationLabel}>Quantity</Text>
              <QuantityStepper value={quantity} onChange={setQuantity} min={1} testID="product-qty" />
            </View>
          )}

          {/* Description */}
          {!!stripHtml(product.description) && (
            <Pressable
              testID="product-description-toggle"
              onPress={() => setDescOpen((v) => !v)}
              style={styles.accordion}
            >
              <View style={styles.accordionHeader}>
                <Text style={styles.accordionTitle}>Description</Text>
                <Ionicons name={descOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.onSurfaceSecondary} />
              </View>
              {descOpen && <Text style={styles.description}>{stripHtml(product.description)}</Text>}
            </Pressable>
          )}

          {/* Non-variation attributes */}
          {product.attributes.filter((a) => !a.hasVariations).length > 0 && (
            <View style={styles.attrs}>
              {product.attributes
                .filter((a) => !a.hasVariations)
                .map((a) => (
                  <View key={a.id} style={styles.attrRow}>
                    <Text style={styles.attrKey}>{a.name}</Text>
                    <Text style={styles.attrVal}>{a.terms.map((t) => t.name).join(", ")}</Text>
                  </View>
                ))}
            </View>
          )}

          {/* Shipping / support links */}
          <View style={styles.links}>
            <Pressable
              testID="product-shipping-link"
              style={styles.linkRow}
              onPress={() => WebBrowser.openBrowserAsync(`${env.websiteUrl}/delivery`).catch(() => {})}
            >
              <Ionicons name="cube-outline" size={18} color={colors.brandSecondary} />
              <Text style={styles.linkText}>Shipping information</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />
            </Pressable>
            <Pressable
              testID="product-support-link"
              style={styles.linkRow}
              onPress={() => WebBrowser.openBrowserAsync(env.supportUrl).catch(() => {})}
            >
              <Ionicons name="help-circle-outline" size={18} color={colors.brandSecondary} />
              <Text style={styles.linkText}>Ask a question</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />
            </Pressable>
          </View>
        </View>

        <ProductRail
          title="You may also like"
          products={relatedItems}
          loading={related.isLoading}
          testID="product-related-rail"
        />
      </ScrollView>

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, { bottom: 96 + insets.bottom }]} testID="added-toast">
          <Ionicons name="checkmark-circle" size={18} color={colors.success} />
          <Text style={styles.toastText}>Added to basket</Text>
          <Pressable onPress={() => router.push("/basket")}>
            <Text style={styles.toastLink}>View</Text>
          </Pressable>
        </View>
      )}

      {/* Sticky bottom CTA */}
      <BlurView intensity={40} tint="dark" style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <FavouriteButton productId={product.id} style={styles.ctaFav} testID="product-favourite-button" />
        <View style={{ flex: 1 }}>
          <Button
            title={canAdd ? "Add to basket" : isVariable && !allSelected ? "Select options" : "Unavailable"}
            icon={canAdd ? "bag-add" : undefined}
            onPress={onAdd}
            disabled={!canAdd}
            testID="add-to-basket-button"
          />
        </View>
      </BlurView>

      {/* Zoom modal */}
      <Modal visible={!!zoom} transparent animationType="fade" onRequestClose={() => setZoom(null)}>
        <View style={styles.zoomWrap}>
          <Pressable testID="zoom-close" onPress={() => setZoom(null)} style={[styles.zoomClose, { top: insets.top + spacing.md }]}>
            <Ionicons name="close" size={28} color={colors.onSurface} />
          </Pressable>
          {zoom && <Image source={zoom} contentFit="contain" style={StyleSheet.absoluteFill} />}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  galleryWrap: { backgroundColor: colors.surfaceTertiary },
  noImage: { alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceTertiary },
  saleBadge: {
    position: "absolute", top: spacing.md, left: spacing.md,
    backgroundColor: colors.brandPrimary, borderRadius: radius.sm,
    paddingHorizontal: spacing.sm, paddingVertical: 3,
  },
  saleText: { color: colors.onBrandPrimary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 1 },
  dots: { position: "absolute", bottom: spacing.md, alignSelf: "center", flexDirection: "row", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: colors.onSurface, width: 18 },
  body: { padding: spacing.lg, gap: spacing.md },
  category: { color: colors.brandSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 1, textTransform: "uppercase" },
  title: { color: colors.onSurface, fontSize: fontSize["2xl"], fontWeight: fontWeight.medium, lineHeight: 30 },
  stockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sku: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  shortDesc: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 21 },
  variationBlock: { gap: spacing.sm },
  variationLabel: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  pill: {
    minHeight: 44, paddingHorizontal: spacing.lg, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  pillSelected: { borderColor: colors.brandPrimary, backgroundColor: colors.brandTertiary },
  pillText: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  pillTextSelected: { color: colors.onSurface },
  hint: { color: colors.warning, fontSize: fontSize.sm },
  qtyBlock: { gap: spacing.sm },
  accordion: {
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md,
  },
  accordionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  accordionTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  description: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 22, marginTop: spacing.md },
  attrs: { gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  attrRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  attrKey: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  attrVal: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, flexShrink: 1, textAlign: "right" },
  links: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md },
  linkText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: fontSize.base },
  cta: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    backgroundColor: "rgba(18,18,20,0.85)",
  },
  ctaFav: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary },
  toast: {
    position: "absolute", left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceTertiary, borderRadius: radius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderWidth: 1, borderColor: colors.border,
  },
  toastText: { flex: 1, color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  toastLink: { color: colors.brandSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  zoomWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  zoomClose: { position: "absolute", right: spacing.lg, zIndex: 2, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
