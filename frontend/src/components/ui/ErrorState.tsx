import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "./Button";
import { friendlyMessage } from "@/src/api/errors";
import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

// Customer-friendly error state with retry. Never shows raw technical errors.
export function ErrorState({
  error,
  title = "Something went wrong",
  onRetry,
  testID = "error-state",
}: {
  error?: unknown;
  title?: string;
  onRetry?: () => void;
  testID?: string;
}) {
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.iconWrap}>
        <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{friendlyMessage(error)}</Text>
      {onRetry && (
        <View style={styles.action}>
          <Button title="Try again" icon="refresh" onPress={onRetry} fullWidth={false} testID={`${testID}-retry`} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium, textAlign: "center" },
  message: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center", lineHeight: 20 },
  action: { marginTop: spacing.md },
});
