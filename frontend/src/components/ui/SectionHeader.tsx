import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

// Section title with an optional "See all" action, used across Home rails.
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  testID,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.row} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onAction && (
        <Pressable
          onPress={onAction}
          hitSlop={8}
          style={styles.action}
          accessibilityRole="button"
          testID={testID ? `${testID}-action` : undefined}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.brandSecondary} />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium },
  action: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionText: { color: colors.brandSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
});
