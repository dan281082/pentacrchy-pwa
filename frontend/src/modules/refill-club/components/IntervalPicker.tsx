import { StyleSheet, View } from "react-native";

import { Chip } from "@/src/components/ui/Chip";
import { spacing } from "@/src/theme";

import { REFILL_INTERVAL_OPTIONS } from "../store";

export function IntervalPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <View style={styles.row} testID="refill-interval-picker">
      {REFILL_INTERVAL_OPTIONS.map((days) => (
        <Chip
          key={days}
          label={`${days} days`}
          selected={value === days}
          onPress={() => onChange(days)}
          testID={`refill-interval-${days}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, paddingHorizontal: spacing.lg },
});
