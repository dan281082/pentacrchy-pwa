import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

// Filter / sort chip. Selected state changes COLOUR/BORDER only — never size,
// padding or font weight (per design guidelines). Fixed height 36pt.
export function Chip({
  label,
  selected = false,
  onPress,
  icon,
  testID,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? styles.selected : styles.unselected]}
    >
      {icon && (
        <Ionicons
          name={icon}
          size={14}
          color={selected ? colors.onBrandPrimary : colors.onSurfaceSecondary}
        />
      )}
      <Text
        style={[styles.label, { color: selected ? colors.onBrandPrimary : colors.onSurfaceSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 36,
    flexShrink: 0,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    borderWidth: 1,
  },
  selected: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  unselected: { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
  label: { fontSize: fontSize.base, fontWeight: fontWeight.medium },
});
