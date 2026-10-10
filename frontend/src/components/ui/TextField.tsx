import { forwardRef } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

type Props = TextInputProps & {
  label: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  prefix?: string;
  testID?: string;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, icon, prefix, style, testID, ...rest },
  ref,
) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.field, !!error && styles.fieldError]}>
        {icon && <Ionicons name={icon} size={18} color={colors.onSurfaceTertiary} />}
        {!!prefix && <Text style={styles.prefix}>{prefix}</Text>}
        <TextInput
          ref={ref}
          testID={testID}
          placeholderTextColor={colors.onSurfaceTertiary}
          style={[styles.input, style]}
          {...rest}
        />
      </View>
      {!!error && (
        <Text style={styles.error} testID={testID ? `${testID}-error` : undefined}>
          {error}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  label: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 52,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  fieldError: { borderColor: colors.error },
  prefix: { color: colors.onSurfaceTertiary, fontSize: fontSize.lg },
  input: { flex: 1, color: colors.onSurface, fontSize: fontSize.lg, paddingVertical: 0 },
  error: { color: colors.error, fontSize: fontSize.sm },
});
