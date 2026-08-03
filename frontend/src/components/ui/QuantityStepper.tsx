import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled = false,
  size = "md",
  testID,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number | null;
  disabled?: boolean;
  size?: "sm" | "md";
  testID?: string;
}) {
  const dim = size === "sm" ? 32 : 40;
  const canDec = !disabled && value > min;
  const canInc = !disabled && (max == null || value < max);

  const step = (delta: number) => {
    Haptics.selectionAsync().catch(() => {});
    onChange(value + delta);
  };

  return (
    <View style={styles.wrap} testID={testID}>
      <Pressable
        testID={testID ? `${testID}-dec` : undefined}
        onPress={() => step(-1)}
        disabled={!canDec}
        style={[styles.btn, { width: dim, height: dim }, !canDec && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Decrease quantity"
      >
        <Ionicons name="remove" size={18} color={colors.onSurface} />
      </Pressable>
      <Text style={[styles.value, { minWidth: dim }]} testID={testID ? `${testID}-value` : undefined}>
        {value}
      </Text>
      <Pressable
        testID={testID ? `${testID}-inc` : undefined}
        onPress={() => step(1)}
        disabled={!canInc}
        style={[styles.btn, { width: dim, height: dim }, !canInc && styles.btnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Increase quantity"
      >
        <Ionicons name="add" size={18} color={colors.onSurface} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignSelf: "flex-start",
  },
  btn: { alignItems: "center", justifyContent: "center" },
  btnDisabled: { opacity: 0.3 },
  value: {
    textAlign: "center",
    color: colors.onSurface,
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    paddingHorizontal: spacing.sm,
  },
});
