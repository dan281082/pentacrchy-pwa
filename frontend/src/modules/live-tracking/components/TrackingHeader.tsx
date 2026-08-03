import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { OrderTracking } from "../types";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export function TrackingHeader({ tracking }: { tracking: OrderTracking }) {
  const rows: { label: string; value: string | null }[] = [
    { label: "Order", value: tracking.orderNumber ? `#${tracking.orderNumber}` : null },
    { label: "Status", value: tracking.orderStatus || null },
    { label: "Courier", value: tracking.courier },
    { label: "Tracking no.", value: tracking.trackingNumber },
    { label: "Dispatched", value: tracking.dispatchDate ? tracking.dispatchDate.slice(0, 10) : null },
    // Estimated delivery only shown if the courier actually provides it.
    { label: "Est. delivery", value: tracking.estimatedDelivery ? tracking.estimatedDelivery.slice(0, 10) : null },
  ];
  return (
    <View style={styles.card} testID="tracking-header">
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <Text style={styles.label}>{r.label}</Text>
          <Text style={styles.value}>{r.value ?? "—"}</Text>
        </View>
      ))}
      {!!tracking.trackingUrl && (
        <View style={styles.linkRow}>
          <Ionicons name="open-outline" size={16} color={colors.brandSecondary} />
          <Text style={styles.link}>Track on courier site</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, margin: spacing.lg, gap: spacing.sm,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  label: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  value: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  linkRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginTop: spacing.sm },
  link: { color: colors.brandSecondary, fontSize: fontSize.base },
});
