import { ReactNode } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView, Edge } from "react-native-safe-area-context";

import { colors } from "@/src/theme";

// Dark, safe-area-aware screen container used by every screen.
export function Screen({
  children,
  style,
  edges = ["top", "left", "right"],
  testID,
}: {
  children: ReactNode;
  style?: ViewStyle;
  edges?: Edge[];
  testID?: string;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={edges} testID={testID}>
      <StatusBar style="light" />
      <View style={[styles.inner, style]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  inner: { flex: 1, backgroundColor: colors.surface },
});
