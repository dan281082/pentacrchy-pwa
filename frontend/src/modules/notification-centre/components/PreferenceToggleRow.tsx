import { StyleSheet, Switch, Text, View } from "react-native";

import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

export function PreferenceToggleRow({
  label,
  description,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {!!description && <Text style={styles.desc}>{description}</Text>}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }}
        thumbColor={colors.onSurface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  label: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  desc: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
});
