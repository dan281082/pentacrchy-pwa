import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { RefillPlan } from "../types";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export function RefillItemRow({ plan }: { plan: RefillPlan }) {
  return (
    <View style={styles.row} testID={`refill-plan-${plan.id}`}>
      <View style={styles.iconWrap}>
        <Ionicons name="repeat-outline" size={18} color={colors.brandSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{plan.item.name}</Text>
        {/* Reminder only — non-medical, no dosage wording. */}
        <Text style={styles.meta}>
          Reminder every {plan.item.intervalDays} days
          {plan.nextReminderDate ? ` · next ${plan.nextReminderDate}` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", gap: spacing.md, alignItems: "center",
    padding: spacing.md, marginHorizontal: spacing.lg, marginBottom: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
  },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  name: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
});
