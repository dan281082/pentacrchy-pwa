import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { QuantityStepper } from "@/src/components/ui/QuantityStepper";
import { TopBar } from "@/src/components/ui/TopBar";
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
  const couponCode = useBasketStore((s) => s.couponCode);
  const increment = useBasketStore((s) => s.increment);
  const setQuantity = useBasketStore((s) => s.setQuantity);
  const remove = useBasketStore((s) => s.remove);
  const setCoupon = useBasketStore((s) => s.setCoupon);
  const count = useBasketStore(selectItemCount);
  const subtotalMinor = useBasketStore(selectSubtotalMinor);

  const [coupon, setCouponInput] = useState("");
  const [checkoutNote, setCheckoutNote] = useState(false);

  const meta = lines[0]?.priceMeta;
  const subtotal = meta ? formatMinor(String(subtotalMinor), meta) : "";

  if (lines.length === 0) {
    return (
      <View style={styles.container} testID="basket-screen">
        <TopBar title="Basket" showBack showBasket={false} />
        <EmptyState
          testID="basket-empty"
          icon="bag-handle-outline"
          title="Your basket is empty"
          message="Browse the shop and add products to your basket."
          actionLabel="Shop now"
          onAction={() => router.replace("/(tabs)/shop")}
        />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="basket-screen">
      <TopBar title={`Basket (${count})`} showBack showBasket={false} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
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

          {/* Coupon */}
          <View style={styles.couponBlock}>
            <Text style={styles.blockTitle}>Coupon</Text>
            {couponCode ? (
              <View style={styles.couponApplied} testID="coupon-applied">
                <Ionicons name="pricetag" size={16} color={colors.success} />
                <Text style={styles.couponCode}>{couponCode}</Text>
                <Text style={styles.couponNote}>Validated at checkout</Text>
                <Pressable testID="coupon-remove" onPress={() => setCoupon(null)} hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={colors.onSurfaceTertiary} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.couponRow}>
                <TextInput
                  testID="coupon-input"
                  value={coupon}
                  onChangeText={setCouponInput}
                  placeholder="Enter code"
                  placeholderTextColor={colors.onSurfaceTertiary}
                  autoCapitalize="characters"
                  style={styles.couponInput}
                />
                <Button
                  title="Apply"
                  fullWidth={false}
                  variant="secondary"
                  onPress={() => { if (coupon.trim()) { setCoupon(coupon.trim().toUpperCase()); setCouponInput(""); } }}
                  testID="coupon-apply"
                />
              </View>
            )}
          </View>

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
              <Ionicons name="information-circle-outline" size={16} color={colors.onSurfaceTertiary} />
              <Text style={styles.noteText}>
                Final VAT, shipping, discounts and total are confirmed by WooCommerce at checkout.
              </Text>
            </View>
          </View>

          {checkoutNote && (
            <View style={styles.checkoutNote} testID="checkout-note">
              <Ionicons name="lock-closed-outline" size={16} color={colors.brandSecondary} />
              <Text style={styles.checkoutNoteText}>
                Secure checkout arrives in the next release. Your basket is saved.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky CTA */}
      <BlurView intensity={40} tint="dark" style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <View style={styles.ctaTotalRow}>
          <Text style={styles.ctaTotalLabel}>Estimated total</Text>
          <Text style={styles.ctaTotal}>{subtotal}</Text>
        </View>
        <Button
          title="Proceed to checkout"
          icon="lock-closed"
          onPress={() => setCheckoutNote(true)}
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
  couponBlock: { gap: spacing.sm, marginTop: spacing.sm },
  blockTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  couponRow: { flexDirection: "row", gap: spacing.sm },
  couponInput: {
    flex: 1, height: 52, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.md,
    color: colors.onSurface, fontSize: fontSize.lg,
  },
  couponApplied: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
  },
  couponCode: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  couponNote: { flex: 1, color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
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
  checkoutNote: { flexDirection: "row", gap: spacing.sm, alignItems: "center", backgroundColor: colors.brandTertiary, borderRadius: radius.md, padding: spacing.md },
  checkoutNoteText: { flex: 1, color: colors.onSurface, fontSize: fontSize.sm, lineHeight: 18 },
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
