import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { glpCheckout, type CryptoInvoice } from "@/src/api/glp/checkout";
import { Button } from "@/src/components/ui/Button";
import { TopBar } from "@/src/components/ui/TopBar";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

const POLL_MS = 5000;

// Status → UX grouping.
const PAID_STATUSES = ["complete"];
const PROGRESS_STATUSES = ["awaiting_payment", "payment_detected", "confirming"];
const FAIL_STATUSES = ["expired", "failed", "cancelled"];

function mmss(total: number): string {
  if (total <= 0) return "00:00";
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function InvoiceScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [invoice, setInvoice] = useState<CryptoInvoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    try {
      const inv = await glpCheckout.getInvoice(orderId);
      setInvoice(inv);
      setCountdown(inv.remainingSeconds);
      setError(null);
      return inv;
    } catch {
      setError("Could not load payment status. Retrying…");
      return null;
    }
  }, [orderId]);

  // Poll until the invoice reaches a final state.
  useEffect(() => {
    let active = true;
    load();
    timer.current = setInterval(async () => {
      if (!active) return;
      const inv = await load();
      if (inv && (inv.isFinal || PAID_STATUSES.includes(inv.status) || FAIL_STATUSES.includes(inv.status))) {
        if (timer.current) clearInterval(timer.current);
      }
    }, POLL_MS);
    return () => {
      active = false;
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  // Local countdown tick.
  useEffect(() => {
    const t = setInterval(() => setCountdown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  const copyAddress = async () => {
    if (!invoice?.address) return;
    await Clipboard.setStringAsync(invoice.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const onRecheck = async () => {
    setRechecking(true);
    try {
      const inv = await glpCheckout.recheck(orderId);
      setInvoice(inv);
      setCountdown(inv.remainingSeconds);
    } catch {
      /* ignore transient */
    } finally {
      setRechecking(false);
    }
  };

  if (!invoice) {
    return (
      <View style={styles.container}>
        <TopBar title="Payment" showBasket={false} />
        <View style={styles.center}>
          <ActivityIndicator color={colors.brandSecondary} />
          <Text style={styles.muted}>Loading invoice…</Text>
          {!!error && <Text style={styles.err}>{error}</Text>}
        </View>
      </View>
    );
  }

  const paid = PAID_STATUSES.includes(invoice.status) || invoice.status === "complete";
  const failed = FAIL_STATUSES.includes(invoice.status);
  const partial = ["partially_paid", "underpaid"].includes(invoice.status);
  const detected = ["payment_detected", "confirming"].includes(invoice.status);

  if (paid) {
    return (
      <View style={styles.container} testID="invoice-screen">
        <TopBar title="Payment complete" showBasket={false} />
        <View style={styles.center}>
          <View style={[styles.badge, { backgroundColor: colors.surfaceSecondary }]}>
            <Ionicons name="checkmark-circle" size={64} color={colors.success} />
          </View>
          <Text style={styles.title}>Payment received</Text>
          <Text style={styles.muted}>Your order is now being processed. You can track it in My Orders.</Text>
          <View style={{ height: spacing.lg }} />
          <Button title="View my orders" icon="receipt-outline" onPress={() => router.replace("/(tabs)/orders")} testID="invoice-view-orders" />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container} testID="invoice-screen">
      <TopBar title="Pay with USDT" showBasket={false} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {/* Status banner */}
        <View style={[styles.statusBar, failed && styles.statusFail, detected && styles.statusDetected]} testID="invoice-status">
          {detected && <ActivityIndicator color={colors.onBrandSecondary ?? colors.onSurface} size="small" />}
          <Text style={styles.statusText}>
            {invoice.statusLabel || invoice.status.replace(/_/g, " ")}
            {detected ? ` · ${invoice.confirmations}/${invoice.requiredConfirmations} confirmations` : ""}
          </Text>
        </View>

        {!failed && (
          <>
            {/* Amount */}
            <View style={styles.amountCard}>
              <Text style={styles.amountLabel}>Send exactly</Text>
              <Text style={styles.amount} testID="invoice-amount">{invoice.amount} {invoice.token}</Text>
              <Text style={styles.network}>{invoice.networkLabel || "TRON (TRC20)"}</Text>
              <Text style={styles.fiat}>≈ {invoice.fiatTotal} {invoice.fiatCurrency}</Text>
            </View>

            {/* QR */}
            {!!invoice.paymentUri && (
              <View style={styles.qrWrap}>
                <View style={styles.qrBox}>
                  <QRCode value={invoice.paymentUri} size={196} backgroundColor="#fff" />
                </View>
              </View>
            )}

            {/* Address */}
            <View>
              <Text style={styles.fieldLabel}>Wallet address ({invoice.token} · {invoice.networkLabel || "TRC20"})</Text>
              <Pressable style={styles.addressBox} onPress={copyAddress} testID="invoice-copy-address">
                <Text style={styles.address} selectable>{invoice.address}</Text>
                <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={copied ? colors.success : colors.brandSecondary} />
              </Pressable>
              {copied && <Text style={styles.copied}>Address copied</Text>}
            </View>

            {/* Countdown */}
            <View style={styles.timerRow}>
              <Ionicons name="time-outline" size={16} color={colors.onSurfaceTertiary} />
              <Text style={styles.timer}>Invoice expires in {mmss(countdown)}</Text>
            </View>

            {partial && (
              <Text style={styles.warn}>
                Partial payment detected. Please send the remaining {invoice.amountRemaining} {invoice.token}.
              </Text>
            )}
            {!!invoice.instruction && <Text style={styles.instruction}>{invoice.instruction}</Text>}

            <Button title="I've sent it — check now" icon="refresh" variant="secondary" onPress={onRecheck} loading={rechecking} testID="invoice-recheck" />
            {invoice.testMode && (
              <View style={styles.testPill}><Text style={styles.testText}>CRYPTO TEST MODE — no real funds</Text></View>
            )}
          </>
        )}

        {failed && (
          <View style={styles.center}>
            <Ionicons name="close-circle" size={56} color={colors.error} />
            <Text style={styles.title}>Payment {invoice.status}</Text>
            <Text style={styles.muted}>This invoice is no longer payable. You can view the order in My Orders.</Text>
            <View style={{ height: spacing.md }} />
            <Button title="View my orders" onPress={() => router.replace("/(tabs)/orders")} />
          </View>
        )}

        {!!invoice.explorerUrl && (
          <Pressable onPress={() => WebBrowser.openBrowserAsync(invoice.explorerUrl).catch(() => {})}>
            <Text style={styles.explorer}>View on blockchain explorer</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.sm },
  muted: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center" },
  err: { color: colors.error, fontSize: fontSize.sm, marginTop: spacing.sm },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium, textAlign: "center" },
  badge: { width: 110, height: 110, borderRadius: 55, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  statusBar: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  statusDetected: { borderColor: colors.brandSecondary },
  statusFail: { borderColor: colors.error },
  statusText: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium, textTransform: "capitalize" },
  amountCard: { alignItems: "center", backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: 2 },
  amountLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  amount: { color: colors.onSurface, fontSize: 30, fontWeight: fontWeight.medium },
  network: { color: colors.brandSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  fiat: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, marginTop: 2 },
  qrWrap: { alignItems: "center" },
  qrBox: { padding: spacing.md, backgroundColor: "#fff", borderRadius: radius.md },
  fieldLabel: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, marginBottom: spacing.sm },
  addressBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  address: { flex: 1, color: colors.onSurface, fontSize: fontSize.base },
  copied: { color: colors.success, fontSize: fontSize.sm, marginTop: spacing.xs },
  timerRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, justifyContent: "center" },
  timer: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  warn: { color: colors.warning, fontSize: fontSize.base, textAlign: "center" },
  instruction: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: "center", lineHeight: 18 },
  testPill: { alignSelf: "center", backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 6 },
  testText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 0.5 },
  explorer: { color: colors.brandSecondary, fontSize: fontSize.base, textAlign: "center", marginTop: spacing.sm },
});
