import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

type Tone = "in" | "low" | "out" | "backorder";

// Stock indicator using WooCommerce's own text. Never invents quantities.
export function StockBadge({
  inStock,
  onBackorder,
  lowStockRemaining,
  text,
  testID,
}: {
  inStock: boolean;
  onBackorder?: boolean;
  lowStockRemaining?: number | null;
  text: string;
  testID?: string;
}) {
  let tone: Tone = inStock ? "in" : "out";
  if (inStock && onBackorder) tone = "backorder";
  else if (inStock && lowStockRemaining != null) tone = "low";

  const cfg = {
    in: { color: colors.success, icon: "checkmark-circle" as const },
    low: { color: colors.warning, icon: "alert-circle" as const },
    backorder: { color: colors.warning, icon: "time" as const },
    out: { color: colors.error, icon: "close-circle" as const },
  }[tone];

  return (
    <View style={[styles.badge, { borderColor: cfg.color }]} testID={testID}>
      <Ionicons name={cfg.icon} size={13} color={cfg.color} />
      <Text style={[styles.text, { color: cfg.color }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  text: { fontSize: fontSize.sm, fontWeight: fontWeight.medium },
});
