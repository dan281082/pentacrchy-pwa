import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { QuantityStepper } from "@/src/components/ui/QuantityStepper";
import { TopBar } from "@/src/components/ui/TopBar";
import { env } from "@/src/config/env";
import {
  useBasketStore,
  selectItemCount,
  selectSubtotalMinor,
} from "@/src/store/basket-store";
import { formatMinor } from "@/src/utils/format";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function BasketScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const lines = useBasketStore((s) => s.lines);
  const setQuantity = useBasketStore((s) => s.setQuantity);
  const remove = useBasketStore((s) => s.remove);
  const count = useBasketStore(selectItemCount);
  const subtotalMinor = useBasketStore(selectSubtotalMinor);

  const meta = lines[0]?.priceMeta;
  const subtotal = meta ? formatMinor(String(subtotalMinor), meta) : "";

  const onCheckout = () => {
    // Secure website-checkout fallback — payment completes on the WooCommerce
    // store (source of truth). Stock is enforced server-side so sold-out units
    // cannot be purchased.
    WebBrowser.openBrowserAsync(`${env.websiteUrl}/checkout`).catch(() => {});
  };

  if (lines.length === 0) {
    return (
      <View style={styles.container} testID="basket-screen">
        <TopBar title="Basket" showBack showBasket={false} />
        <EmptyState
          testID="basket-empty"
          icon="bag-handle-outline"
          title="Your basket is empty"
          message="Browse available vials and add them to your basket."
          actionLabel="Browse vials"
          onAction={() => router.replace("/(tabs)/shop")}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="basket-screen">
      <TopBar title={`Basket (${count})`} showBack showBasket={false} />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 180 + insets.bottom }}
      >
        {/* Line items */}
        {lines.map((line) => {
          const lineTotal = formatMinor(String((parseInt(line.unitPriceMinor, 10) || 0) * line.quantity), line.priceMeta);
          return (
            <View key={line.key} style={styles.line} testID={`basket-line-${line.key}`}>
              <View style={styles.lineImageWrap}>
                <Image source={line.image ?? undefined} contentFit="cover" style={styles.lineImage} />
              </View>
              <View style={styles.lineBody}>
                <View style={styles.lineHeader}>
                  <Text style={styles.lineName} numberOfLines={2}>{line.name}</Text>
                  <Pressable testID={`basket-remove-${line.key}`} onPress={() => remove(line.key)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={18} color={colors.onSurfaceTertiary} />
                  </Pressable>
                </View>
                {!!line.variationLabel && <Text style={styles.lineVariation}>{line.variationLabel}</Text>}
                <Text style={styles.lineUnit}>{formatMinor(line.unitPriceMinor, line.priceMeta)} each</Text>
                <View style={styles.lineFooter}>
                  <QuantityStepper
                    value={line.quantity}
                    size="sm"
                    onChange={(q) => setQuantity(line.key, q)}
                    min={line.soldIndividually ? 1 : 0}
                    max={line.soldIndividually ? 1 : null}
                    testID={`basket-qty-${line.key}`}
                  />
                  <Text style={styles.lineTotal}>{lineTotal}</Text>
                </View>
              </View>
            </View>
          );
        })}

        {/* Summary */}
        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Subtotal (est.)</Text>
            <Text style={styles.summaryValue}>{subtotal}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>VAT</Text>
            <Text style={styles.summaryMuted}>Calculated at checkout</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Shipping</Text>
            <Text style={styles.summaryMuted}>Calculated at checkout</Text>
          </View>
          <View style={styles.noteBox}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.brandSecondary} />
            <Text style={styles.noteText}>
              Checkout & payment complete securely on the Apeps website. Final VAT, shipping and
              total are confirmed by WooCommerce, and stock limits prevent overselling.
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <BlurView intensity={40} tint="dark" style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.ctaTotalRow}>
          <Text style={styles.ctaTotalLabel}>Estimated total</Text>
          <Text style={styles.ctaTotal}>{subtotal}</Text>
        </View>
        <Button
          title="Checkout securely"
          icon="lock-closed"
          onPress={onCheckout}
          testID="proceed-checkout-button"
        />
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  line: {
    flexDirection: "row", gap: spacing.md, backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md, padding: spacing.sm, borderWidth: 1, borderColor: colors.border,
  },
  lineImageWrap: { width: 84, height: 84, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  lineImage: { width: "100%", height: "100%" },
  lineBody: { flex: 1, gap: 2 },
  lineHeader: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  lineName: { flex: 1, color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  lineVariation: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  lineUnit: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  lineFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: spacing.sm },
  lineTotal: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  summary: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, gap: spacing.md, marginTop: spacing.sm,
  },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  summaryLabel: { color: colors.onSurfaceSecondary, fontSize: fontSize.base },
  summaryValue: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  summaryMuted: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  noteBox: { flexDirection: "row", gap: spacing.sm, alignItems: "flex-start", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  noteText: { flex: 1, color: colors.onSurfaceTertiary, fontSize: fontSize.sm, lineHeight: 18 },
  cta: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
    backgroundColor: "rgba(18,18,20,0.85)",
  },
  ctaTotalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  ctaTotalLabel: { color: colors.onSurfaceSecondary, fontSize: fontSize.base },
  ctaTotal: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium },
});
