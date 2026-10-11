// Staff fulfilment order screen: everything needed to pack + post an order with
// the customer's own postage label / QR, and the Ready / Dispatched actions.

import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { glpFulfilment } from "@/src/api/glp/fulfilment";
import { FulfilStatePill, FulfilStepper } from "@/src/components/fulfilment/FulfilState";
import { LabelViewer } from "@/src/components/orders/LabelViewer";
import { Button } from "@/src/components/ui/Button";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { TopBar } from "@/src/components/ui/TopBar";
import { useAuth } from "@/src/context/auth";
import { useFulfilmentAction, useFulfilmentOrder } from "@/src/hooks/use-fulfilment";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const EVENT_LABEL: Record<string, string> = {
  label_uploaded: "Customer uploaded label",
  label_replaced: "Customer replaced label",
  ready: "Marked ready to dispatch",
  dispatched: "Marked dispatched",
};

function Field({ icon, label, value, copy }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  const body = (
    <View style={styles.field}>
      <Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <Text style={styles.fieldValue} selectable>{value}</Text>
      </View>
      {copy && <Ionicons name={copied ? "checkmark" : "copy-outline"} size={18} color={copied ? colors.success : colors.onSurfaceTertiary} />}
    </View>
  );
  if (!copy) return body;
  return (
    <Pressable
      onPress={async () => { await Clipboard.setStringAsync(value); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
      accessibilityRole="button"
      accessibilityLabel={`Copy ${label}`}
    >
      {body}
    </Pressable>
  );
}

export default function FulfilmentOrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const orderId = Number(id);
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const q = useFulfilmentOrder(orderId);
  const ready = useFulfilmentAction(orderId, "ready");
  const dispatch = useFulfilmentAction(orderId, "dispatch");
  const [confirmDispatch, setConfirmDispatch] = useState(false);
  const o = q.data;

  if (!user?.fulfilment) {
    return (
      <View style={styles.container}>
        <TopBar title="Fulfilment" showBack showBasket={false} />
        <EmptyState icon="lock-closed-outline" title="Staff only" message="Your account doesn't have fulfilment access." />
      </View>
    );
  }
  if (q.isLoading) {
    return (
      <View style={styles.container}>
        <TopBar title="Fulfilment" showBack showBasket={false} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="50%" height={22} />
          <Skeleton width="100%" height={120} rounded={radius.md} />
          <Skeleton width="100%" height={200} rounded={radius.md} />
        </View>
      </View>
    );
  }
  if (q.isError || !o) {
    return (
      <View style={styles.container}>
        <TopBar title="Fulfilment" showBack showBasket={false} />
        <ErrorState error={q.error} title="Order unavailable" onRetry={() => q.refetch()} />
      </View>
    );
  }

  const a = o.shippingAddress;
  const address = [a.name, a.line1, a.line2, a.city, a.postcode, a.country].filter(Boolean).join("\n");
  const actionError = (ready.error as Error | null)?.message || (dispatch.error as Error | null)?.message;
  const canDispatch = o.status === "processing" && (o.state === "label_supplied" || o.state === "ready");

  return (
    <View style={styles.container} testID="fulfil-detail-screen">
      <TopBar title={`Order #${o.number}`} showBack showBasket={false} />
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
      >
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.meta}>Paid {formatDateTime(o.datePaid ?? o.dateCreated)}</Text>
            <FulfilStatePill state={o.state} testID="fulfil-detail-state" />
          </View>
          <FulfilStepper state={o.state} />
        </View>

        <Section title="Postage">
          {o.label ? (
            <LabelViewer label={o.label} load={() => glpFulfilment.label(orderId)} orderNumber={o.number} staffActions testID="staff-label" />
          ) : (
            <View style={styles.info}>
              <Ionicons name="time-outline" size={18} color={colors.warning} />
              <Text style={styles.infoText}>Waiting for the customer to upload their postage label or QR code.</Text>
            </View>
          )}
        </Section>

        <Section title={`Items · ${o.itemCount}`}>
          {o.items.map((it, i) => (
            <View key={`${it.name}-${i}`} style={styles.item} testID={`fulfil-item-${i}`}>
              <View style={styles.qty}><Text style={styles.qtyText}>{it.qty}×</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                {(!!it.sku || Object.keys(it.attributes).length > 0) && (
                  <Text style={styles.meta}>
                    {[it.sku && `SKU ${it.sku}`, ...Object.entries(it.attributes).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(" · ")}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </Section>

        <Section title="Customer">
          <Field icon="person-outline" label="Name" value={o.customer.name} />
          <Field icon="paper-plane-outline" label="Telegram" value={o.customer.telegram ? `@${o.customer.telegram.replace(/^@/, "")}` : ""} copy />
          <Field icon="mail-outline" label="Email" value={o.customer.email} copy />
          <Field icon="call-outline" label="Phone" value={o.customer.phone} copy />
          <Field icon="location-outline" label="Delivery address" value={address} copy />
          <Field icon="chatbox-ellipses-outline" label="Customer note" value={o.customerNote} />
        </Section>

        {o.log.length > 0 && (
          <Section title="History">
            {o.log.slice().reverse().map((l, i) => (
              <Text key={i} style={styles.meta}>
                {formatDateTime(l.at)} · {EVENT_LABEL[l.event] ?? l.event}{l.by ? ` · ${l.by}` : ""}
              </Text>
            ))}
          </Section>
        )}

        {!!actionError && <Text style={styles.error} testID="fulfil-action-error">{actionError}</Text>}

        {o.state === "label_supplied" && (
          <Button title="Mark ready to dispatch" icon="cube-outline" variant="secondary" loading={ready.isPending} onPress={() => ready.mutate()} testID="fulfil-mark-ready" />
        )}
        {canDispatch && (
          confirmDispatch ? (
            <View style={styles.confirm} testID="fulfil-dispatch-confirm">
              <Text style={styles.confirmText}>Mark #{o.number} as dispatched? The customer can no longer change the label, and the order will be set to Completed.</Text>
              <View style={styles.rowGap}>
                <View style={{ flex: 1 }}><Button title="Cancel" variant="ghost" onPress={() => setConfirmDispatch(false)} testID="fulfil-dispatch-cancel" /></View>
                <View style={{ flex: 1 }}>
                  <Button title="Confirm" icon="checkmark" loading={dispatch.isPending} onPress={() => dispatch.mutate(undefined, { onSettled: () => setConfirmDispatch(false) })} testID="fulfil-dispatch-confirm-button" />
                </View>
              </View>
            </View>
          ) : (
            <Button title="Mark dispatched" icon="paper-plane-outline" onPress={() => setConfirmDispatch(true)} testID="fulfil-mark-dispatched" />
          )
        )}
        {o.state === "dispatched" && (
          <View style={styles.info} testID="fulfil-dispatched-info">
            <Ionicons name="checkmark-circle" size={18} color={colors.success} />
            <Text style={styles.infoText}>Dispatched {formatDateTime(o.dispatchedAt)}. Label locked.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  sectionTitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm, marginLeft: spacing.xs },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowGap: { flexDirection: "row", gap: spacing.sm },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  info: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  infoText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 },
  item: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  qty: { minWidth: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
  qtyText: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  itemName: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  field: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md, minHeight: 44 },
  fieldLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  fieldValue: { color: colors.onSurface, fontSize: fontSize.base, marginTop: 2, lineHeight: 20 },
  error: { color: colors.error, fontSize: fontSize.base },
  confirm: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandPrimary, padding: spacing.lg, gap: spacing.md },
  confirmText: { color: colors.onSurface, fontSize: fontSize.base, lineHeight: 20 },
});
