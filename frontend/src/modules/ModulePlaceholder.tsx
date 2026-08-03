import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/src/components/ui/Button";
import type { ModuleDefinition } from "@/src/modules/types";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

// Roadmap placeholder shown for a module that isn't built yet (status "planned")
// or has no registered component. Honest, on-brand, and auth-aware.
export function ModulePlaceholder({ module }: { module: ModuleDefinition }) {
  const router = useRouter();
  return (
    <View style={styles.wrap} testID={`module-placeholder-${module.id}`}>
      <View style={styles.iconWrap}>
        <Ionicons name={module.icon} size={40} color={colors.brandSecondary} />
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{module.status === "beta" ? "BETA" : "COMING SOON"}</Text>
      </View>
      <Text style={styles.title}>{module.title}</Text>
      <Text style={styles.desc}>{module.description}</Text>
      {module.requiresAuth && (
        <Text style={styles.authNote}>Available once secure sign-in is enabled.</Text>
      )}
      <View style={styles.action}>
        <Button title="Back" variant="secondary" icon="chevron-back" fullWidth={false} onPress={() => router.back()} testID="module-placeholder-back" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  iconWrap: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  badge: { backgroundColor: colors.brandTertiary, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 4 },
  badgeText: { color: colors.onBrandTertiary, fontSize: 10, fontWeight: fontWeight.medium, letterSpacing: 1 },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium, textAlign: "center" },
  desc: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center", lineHeight: 21 },
  authNote: { color: colors.warning, fontSize: fontSize.sm, textAlign: "center" },
  action: { marginTop: spacing.md },
});
