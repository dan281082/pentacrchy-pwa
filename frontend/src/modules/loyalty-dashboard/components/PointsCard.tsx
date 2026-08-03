import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { LoyaltySummary } from "../types";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

function formatValue(v: LoyaltySummary["redemptionValue"]): string {
  if (!v) return "";
  const amount = (parseInt(v.amountMinor, 10) || 0) / 100;
  return `${v.currency} ${amount.toFixed(2)}`;
}

export function PointsCard({ summary }: { summary: LoyaltySummary }) {
  return (
    <View style={styles.card} testID="loyalty-points-card">
      <View style={styles.header}>
        <Ionicons name="sparkles" size={18} color={colors.onBrandTertiary} />
        <Text style={styles.label}>Your points</Text>
        {!!summary.tier && (
          <View style={styles.tier}><Text style={styles.tierText}>{summary.tier}</Text></View>
        )}
      </View>
      <Text style={styles.points} testID="loyalty-points-value">
        {summary.points != null ? summary.points.toLocaleString() : "—"}
      </Text>
      {!!summary.redemptionValue && (
        <Text style={styles.value}>Worth approx. {formatValue(summary.redemptionValue)}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.brandTertiary, borderRadius: radius.lg, padding: spacing.xl,
    gap: spacing.sm, margin: spacing.lg,
  },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  label: { color: colors.onBrandTertiary, fontSize: fontSize.base, fontWeight: fontWeight.medium, flex: 1 },
  tier: { backgroundColor: "rgba(255,255,255,0.15)", borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 2 },
  tierText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  points: { color: colors.onSurface, fontSize: 40, fontWeight: fontWeight.medium },
  value: { color: colors.onBrandTertiary, fontSize: fontSize.base },
});
