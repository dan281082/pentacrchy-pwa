import { StyleSheet, Text, View } from "react-native";

import type { PriceInfo } from "@/src/types/catalogue";
import { displayPrice, hasStrikethrough, regularPriceStr } from "@/src/utils/format";
import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

// Renders WooCommerce-provided prices. Sale price in brand colour with the
// original struck through in a muted tone. VAT label shown verbatim + muted.
export function PriceDisplay({
  prices,
  size = "md",
  showTax = true,
  testID,
}: {
  prices: PriceInfo;
  size?: "sm" | "md" | "lg";
  showTax?: boolean;
  testID?: string;
}) {
  const strike = hasStrikethrough(prices);
  const main = { sm: fontSize.base, md: fontSize.lg, lg: fontSize["2xl"] }[size];
  const sub = { sm: fontSize.sm, md: fontSize.sm, lg: fontSize.base }[size];

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.row}>
        <Text style={[styles.current, { fontSize: main, color: strike ? colors.brandSecondary : colors.onSurface }]}>
          {displayPrice(prices)}
        </Text>
        {strike && (
          <Text style={[styles.strike, { fontSize: sub }]}>{regularPriceStr(prices)}</Text>
        )}
      </View>
      {showTax && !!prices.taxLabel && (
        <Text style={styles.tax}>{prices.taxLabel}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 2 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: spacing.sm, flexWrap: "wrap" },
  current: { fontWeight: fontWeight.medium },
  strike: {
    color: colors.onSurfaceTertiary,
    textDecorationLine: "line-through",
    fontWeight: fontWeight.regular,
  },
  tax: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
});
