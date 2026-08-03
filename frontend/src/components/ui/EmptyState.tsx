import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "./Button";
import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

// Full-flex empty state: icon + muted text + optional primary action.
export function EmptyState({
  icon = "cube-outline",
  title,
  message,
  actionLabel,
  onAction,
  testID,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={40} color={colors.onSurfaceTertiary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {!!message && <Text style={styles.message}>{message}</Text>}
      {actionLabel && onAction && (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} fullWidth={false} testID={`${testID}-action`} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium, textAlign: "center" },
  message: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center", lineHeight: 20 },
  action: { marginTop: spacing.md },
});
