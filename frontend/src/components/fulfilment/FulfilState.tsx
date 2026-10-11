import { StyleSheet, Text, View } from "react-native";

import type { FulfilmentState } from "@/src/types/order";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export const FULFIL_STATES: FulfilmentState[] = ["awaiting_label", "label_supplied", "ready", "dispatched"];

export const FULFIL_LABEL: Record<FulfilmentState, string> = {
  awaiting_label: "Awaiting label",
  label_supplied: "Label supplied",
  ready: "Ready to dispatch",
  dispatched: "Dispatched",
};

export const FULFIL_COLOR: Record<FulfilmentState, string> = {
  awaiting_label: colors.warning,
  label_supplied: colors.brandSecondary,
  ready: colors.brandPrimary,
  dispatched: colors.success,
};

export function FulfilStatePill({ state, testID }: { state: FulfilmentState; testID?: string }) {
  return (
    <View style={[styles.pill, { borderColor: FULFIL_COLOR[state] }]} testID={testID}>
      <View style={[styles.dot, { backgroundColor: FULFIL_COLOR[state] }]} />
      <Text style={styles.text}>{FULFIL_LABEL[state]}</Text>
    </View>
  );
}

/** Awaiting label → Label supplied → Ready to dispatch → Dispatched */
export function FulfilStepper({ state }: { state: FulfilmentState }) {
  const at = FULFIL_STATES.indexOf(state);
  return (
    <View style={styles.stepper} testID="fulfil-stepper">
      {FULFIL_STATES.map((s, i) => {
        const done = i <= at;
        return (
          <View key={s} style={styles.step}>
            <View style={[styles.bar, done && { backgroundColor: FULFIL_COLOR[state] }]} />
            <Text style={[styles.stepText, done && styles.stepTextOn]} numberOfLines={2}>{FULFIL_LABEL[s]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  stepper: { flexDirection: "row", gap: spacing.xs },
  step: { flex: 1, gap: 6 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.surfaceTertiary },
  stepText: { color: colors.onSurfaceTertiary, fontSize: 11 },
  stepTextOn: { color: colors.onSurface, fontWeight: fontWeight.medium },
});
