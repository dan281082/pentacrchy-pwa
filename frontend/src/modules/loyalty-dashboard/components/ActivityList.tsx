import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Chip } from "@/src/components/ui/Chip";
import type { LoyaltyActivity } from "../types";
import { useLoyaltyStore } from "../store";
import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

export function ActivityList({ activity }: { activity: LoyaltyActivity[] }) {
  const filter = useLoyaltyStore((s) => s.activityFilter);
  const setFilter = useLoyaltyStore((s) => s.setActivityFilter);

  const filtered = activity.filter((a) => {
    if (filter === "all") return true;
    if (filter === "earned") return a.type === "earned";
    return a.type === "redeemed";
  });

  return (
    <View style={styles.wrap} testID="loyalty-activity-list">
      <Text style={styles.title}>Activity</Text>
      <View style={styles.chips}>
        <Chip label="All" selected={filter === "all"} onPress={() => setFilter("all")} testID="loyalty-filter-all" />
        <Chip label="Earned" selected={filter === "earned"} onPress={() => setFilter("earned")} testID="loyalty-filter-earned" />
        <Chip label="Redeemed" selected={filter === "redeemed"} onPress={() => setFilter("redeemed")} testID="loyalty-filter-redeemed" />
      </View>
      {filtered.length === 0 ? (
        <Text style={styles.none}>No activity to show.</Text>
      ) : (
        filtered.map((a) => (
          <View key={a.id} style={styles.row}>
            <Ionicons
              name={a.type === "redeemed" ? "arrow-up-circle-outline" : "arrow-down-circle-outline"}
              size={18}
              color={a.type === "redeemed" ? colors.warning : colors.success}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.desc}>{a.description}</Text>
              <Text style={styles.date}>{a.date.slice(0, 10)}</Text>
            </View>
            <Text style={[styles.points, { color: a.points < 0 ? colors.warning : colors.success }]}>
              {a.points > 0 ? `+${a.points}` : a.points}
            </Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, gap: spacing.md },
  title: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  chips: { flexDirection: "row", gap: spacing.sm },
  none: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, paddingVertical: spacing.lg },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  desc: { color: colors.onSurface, fontSize: fontSize.base },
  date: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  points: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
});
