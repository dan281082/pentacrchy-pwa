import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { glpCheckout, type CryptoNetwork, type ShippingMethod, type OrderItemInput, type ShippingAddressInput } from "@/src/api/glp/checkout";
import { GlpError } from "@/src/api/glp/client";
import { Button } from "@/src/components/ui/Button";
import { TextField } from "@/src/components/ui/TextField";
import { TopBar } from "@/src/components/ui/TopBar";
import { useAuth } from "@/src/context/auth";
import { useBasketStore, selectItemCount, selectSubtotalMinor } from "@/src/store/basket-store";
import { formatMinor } from "@/src/utils/format";
import { stripHtml } from "@/src/utils/html";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const lines = useBasketStore((s) => s.lines);
  const count = useBasketStore(selectItemCount);
  const subtotalMinor = useBasketStore(selectSubtotalMinor);
  const meta = lines[0]?.priceMeta;

  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [postcode, setPostcode] = useState("");
  const [phone, setPhone] = useState("");

  const [methods, setMethods] = useState<ShippingMethod[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>("");
  const [quoting, setQuoting] = useState(false);
  const [networks, setNetworks] = useState<CryptoNetwork[]>([]);
  const [network, setNetwork] = useState<string>("");
  const [networksLoading, setNetworksLoading] = useState(true);
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const items: OrderItemInput[] = useMemo(
    () => lines.map((l) => ({ product_id: l.productId, variation_id: l.variationId ?? undefined, qty: l.quantity })),
    [lines],
  );

  const address: ShippingAddressInput = useMemo(
    () => ({
      name: `${firstName} ${lastName}`.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      line1: line1.trim(),
      line2: line2.trim(),
      city: city.trim(),
      postcode: postcode.trim(),
      country: "GB",
      phone: phone.trim(),
    }),
    [firstName, lastName, line1, line2, city, postcode, phone],
  );

  const addressReady = !!(firstName && line1 && city && postcode);

  const quote = useCallback(async () => {
    if (!addressReady || !items.length) return;
    setQuoting(true);
    setError(null);
    try {
      const m = await glpCheckout.quoteShipping(items, address);
      setMethods(m);
      setSelectedMethod((prev) => (m.some((x) => x.id === prev) ? prev : m[0]?.id ?? ""));
    } catch (e) {
      setMethods([]);
      setError(e instanceof GlpError ? e.message : "Could not load shipping options.");
    } finally {
      setQuoting(false);
    }
  }, [addressReady, items, address]);

  // Auto-quote shortly after the address becomes complete.
  useEffect(() => {
    if (!addressReady) return;
    const t = setTimeout(quote, 500);
    return () => clearTimeout(t);
  }, [addressReady, postcode, city, line1, quote]);

  // Payment networks come ONLY from the gateway's enabled list (via the connector).
  const loadNetworks = useCallback(async () => {
    setNetworksLoading(true);
    try {
      const list = await glpCheckout.networks();
      setNetworks(list);
      setNetwork((cur) =>
        cur && list.some((n) => n.id === cur) ? cur : list[0]?.id ?? "",
      );
    } catch {
      setNetworks([]);
    } finally {
      setNetworksLoading(false);
    }
  }, []);
  useEffect(() => { loadNetworks(); }, [loadNetworks]);

  const onPlace = async () => {
    setError(null);
    if (!addressReady) return setError("Please complete your delivery address.");
    if (!selectedMethod) return setError("Postage option not confirmed yet. Please wait a moment and try again.");
    if (!network) return setError("Please choose a payment network.");
    setPlacing(true);
    try {
      const res = await glpCheckout.createOrder({
        items,
        shipping_address: address,
        shipping_method: selectedMethod,
        network,
        client_ref: `app-${Date.now()}`,
      });
      useBasketStore.getState().clear();
      router.replace({ pathname: "/checkout/invoice/[id]", params: { id: String(res.orderId) } });
    } catch (e) {
      if (e instanceof GlpError && e.code === "basket_invalid") {
        setError("Stock changed while you were shopping. Please review your basket.");
      } else {
        setError(e instanceof GlpError ? e.message : "Could not place your order. Please try again.");
      }
    } finally {
      setPlacing(false);
    }
  };

  if (lines.length === 0) {
    return (
      <View style={styles.container}>
        <TopBar title="Checkout" showBack showBasket={false} />
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Your basket is empty.</Text>
          <Button title="Browse products" onPress={() => router.replace("/(tabs)/shop")} />
        </View>
      </View>
    );
  }

  const selected = methods.find((m) => m.id === selectedMethod);

  return (
    <View style={styles.container} testID="checkout-screen">
      <TopBar title="Checkout" showBack showBasket={false} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + 280 }}>
          <Text style={styles.section}>Delivery address</Text>
          <View style={styles.row}>
            <View style={{ flex: 1 }}><TextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" testID="co-first" /></View>
            <View style={{ flex: 1 }}><TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" testID="co-last" /></View>
          </View>
          <TextField label="Address line 1" value={line1} onChangeText={setLine1} testID="co-line1" />
          <TextField label="Address line 2 (optional)" value={line2} onChangeText={setLine2} testID="co-line2" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}><TextField label="City" value={city} onChangeText={setCity} autoCapitalize="words" testID="co-city" /></View>
            <View style={{ flex: 1 }}><TextField label="Postcode" value={postcode} onChangeText={setPostcode} autoCapitalize="characters" testID="co-postcode" /></View>
          </View>
          <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" testID="co-phone" />
          <Text style={styles.hint}>Country: United Kingdom</Text>

          <Text style={styles.section}>Postage</Text>
          <View style={styles.ship} testID="co-postage-info">
            <Ionicons name="document-attach-outline" size={20} color={colors.brandSecondary} />
            <Text style={styles.shipLabel}>
              You supply your own postage. After payment, upload your postage label or QR code from My Orders.
            </Text>
          </View>
          {addressReady && !quoting && methods.length === 0 && (
            <Pressable onPress={quote}><Text style={styles.retry}>Couldn&apos;t confirm postage option — tap to retry</Text></Pressable>
          )}

          <Text style={styles.section}>Pay with USDT on</Text>
          {networksLoading ? (
            <Text style={styles.hint}>Loading payment networks…</Text>
          ) : networks.length === 0 ? (
            <Pressable onPress={loadNetworks}><Text style={styles.retry}>No payment networks available — tap to retry</Text></Pressable>
          ) : (
            networks.map((n) => {
              const sel = n.id === network;
              return (
                <Pressable
                  key={n.id}
                  testID={`co-network-${n.id}`}
                  onPress={() => setNetwork(n.id)}
                  style={[styles.ship, sel && { borderColor: colors.brandSecondary }]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: sel }}
                >
                  <Ionicons name={sel ? "radio-button-on" : "radio-button-off"} size={20} color={sel ? colors.brandSecondary : colors.onSurfaceTertiary} />
                  <Text style={styles.shipLabel}>{n.token} · {n.label}</Text>
                </Pressable>
              );
            })
          )}

          <Text style={styles.section}>Order summary</Text>
          <View style={styles.summary}>
            {lines.map((l) => (
              <View key={l.key} style={styles.sumRow}>
                <Text style={styles.sumName} numberOfLines={1}>{l.quantity}× {l.name}</Text>
                <Text style={styles.sumVal}>{formatMinor(String((parseInt(l.unitPriceMinor, 10) || 0) * l.quantity), l.priceMeta)}</Text>
              </View>
            ))}
            <View style={[styles.sumRow, styles.sumBorder]}>
              <Text style={styles.sumName}>Subtotal ({count})</Text>
              <Text style={styles.sumVal}>{meta ? formatMinor(String(subtotalMinor), meta) : ""}</Text>
            </View>
            <View style={styles.sumRow}>
              <Text style={styles.sumName}>Postage</Text>
              <Text style={styles.sumVal}>{selected && Number(selected.cost) !== 0 ? stripHtml(selected.costDisplay) : "Your own label"}</Text>
            </View>
          </View>

          {!!error && <Text style={styles.error} testID="checkout-error">{error}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.cta, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button title="Place order & pay with USDT" icon="logo-bitcoin" onPress={onPlace} loading={placing} disabled={!addressReady || !selectedMethod || !network} testID="place-order-button" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.lg, padding: spacing.xl },
  emptyText: { color: colors.onSurfaceTertiary, fontSize: fontSize.lg },
  section: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium, marginTop: spacing.sm },
  row: { flexDirection: "row", gap: spacing.md },
  hint: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  retry: { color: colors.brandSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  ship: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  shipLabel: { flex: 1, color: colors.onSurface, fontSize: fontSize.base },
  summary: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.sm },
  sumRow: { flexDirection: "row", justifyContent: "space-between", gap: spacing.md },
  sumName: { flex: 1, color: colors.onSurfaceSecondary, fontSize: fontSize.base },
  sumVal: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  sumBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm, marginTop: spacing.xs },
  error: { color: colors.error, fontSize: fontSize.base },
  cta: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.surface },
});
