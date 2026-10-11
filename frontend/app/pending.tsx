import { Redirect } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui/Button";
import { useAuth } from "@/src/context/auth";
import { displayTelegram } from "@/src/utils/telegram";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function PendingScreen() {
  const insets = useSafeAreaInsets();
  const { status, user, refreshMe, logout } = useAuth();
  const [checking, setChecking] = useState(false);

  if (status === "loading") return null;
  if (status === "ready") return <Redirect href="/(tabs)" />;
  if (status === "signedOut") return <Redirect href="/(auth)/login" />;

  const onCheck = async () => {
    setChecking(true);
    try {
      await refreshMe();
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]} testID="pending-screen">
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="hourglass-outline" size={44} color={colors.brandSecondary} />
        </View>
        <Text style={styles.title}>Account pending approval</Text>
        <Text style={styles.message}>
          Thanks{user?.firstName ? `, ${user.firstName}` : ""}! Your account is awaiting approval
          by a community admin. Once approved you’ll be able to view available products and place orders.
        </Text>

        {!!user?.telegramUsername && (
          <View style={styles.tgCard} testID="pending-telegram">
            <Ionicons name="paper-plane-outline" size={18} color={colors.brandSecondary} />
            <Text style={styles.tgText}>{displayTelegram(user.telegramUsername)}</Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button
            title="Check approval status"
            icon="refresh"
            onPress={onCheck}
            loading={checking}
            testID="pending-refresh"
          />
          <Button
            title="Sign out"
            variant="ghost"
            onPress={logout}
            testID="pending-logout"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  iconWrap: {
    width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
    borderWidth: 1, borderColor: colors.border,
  },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium, textAlign: "center" },
  message: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center", lineHeight: 22 },
  tgCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    marginTop: spacing.sm,
  },
  tgText: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  actions: { alignSelf: "stretch", gap: spacing.md, marginTop: spacing.xl },
});
