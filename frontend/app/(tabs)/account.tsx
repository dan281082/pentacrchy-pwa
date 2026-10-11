import { useRouter } from "expo-router";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { StockAlerts } from "@/src/components/account/StockAlerts";
import { Button } from "@/src/components/ui/Button";
import { TopBar } from "@/src/components/ui/TopBar";
import { env } from "@/src/config/env";
import { useAuth } from "@/src/context/auth";
import { useFavouritesStore } from "@/src/store/favourites-store";
import { displayTelegram } from "@/src/utils/telegram";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

const CONTACT_EMAIL = "thepentarchy@proton.me";

type RowProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  testID: string;
};

function Row({ icon, label, value, onPress, testID }: RowProps) {
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <Ionicons name={icon} size={20} color={colors.onSurfaceSecondary} />
      <Text style={styles.rowLabel}>{label}</Text>
      {!!value && <Text style={styles.rowValue}>{value}</Text>}
      <Ionicons name="chevron-forward" size={18} color={colors.onSurfaceTertiary} />
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const favCount = useFavouritesStore((s) => s.ids.length);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Member";

  return (
    <View style={styles.container} testID="account-screen">
      <TopBar title="Account" showBasket />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {/* Member header */}
        <View style={styles.member} testID="account-member-card">
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(user?.firstName?.[0] ?? user?.email?.[0] ?? "A").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{fullName}</Text>
            {!!user?.email && <Text style={styles.memberSub} numberOfLines={1}>{user.email}</Text>}
            {!!user?.telegramUsername && (
              <View style={styles.tgRow}>
                <Ionicons name="paper-plane-outline" size={13} color={colors.brandSecondary} />
                <Text style={styles.tgText}>{displayTelegram(user.telegramUsername)}</Text>
              </View>
            )}
          </View>
          <View style={styles.approvedBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.success} />
            <Text style={styles.approvedText}>Approved</Text>
          </View>
        </View>

        <StockAlerts />

        <Section title="Shopping">
          <Row icon="heart-outline" label="Favourites" value={favCount ? String(favCount) : undefined} onPress={() => router.push("/favourites")} testID="account-favourites" />
          <Row icon="bag-handle-outline" label="Basket" onPress={() => router.push("/basket")} testID="account-basket" />
          <Row icon="receipt-outline" label="My Orders" onPress={() => router.push("/(tabs)/orders")} testID="account-orders" />
        </Section>

        <Section title="Contact">
          <Row icon="mail-outline" label="Email us" value={CONTACT_EMAIL} onPress={() => Linking.openURL(`mailto:${CONTACT_EMAIL}`).catch(() => {})} testID="account-contact-email" />
        </Section>


        <Section title="App">
          <Row icon="information-circle-outline" label="Version" value={env.currentVersion} onPress={() => {}} testID="account-version" />
        </Section>

        <Button
          title="Sign out"
          variant="ghost"
          icon="log-out-outline"
          onPress={logout}
          style={{ marginTop: spacing.sm }}
          testID="account-logout"
        />

        <Text style={styles.footer}>
          Pentarchy — private members&apos; storefront.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  member: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.xl,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandTertiary, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.onBrandTertiary, fontSize: fontSize.xl, fontWeight: fontWeight.medium },
  memberName: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  memberSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  tgRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  tgText: { color: colors.brandSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  approvedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.surfaceTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  approvedText: { color: colors.success, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  section: { marginBottom: spacing.xl },
  sectionTitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm, marginLeft: spacing.xs },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, minHeight: 52,
  },
  pressed: { backgroundColor: colors.surfaceTertiary },
  rowLabel: { flex: 1, color: colors.onSurface, fontSize: fontSize.base },
  rowValue: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  footer: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, lineHeight: 18, textAlign: "center", paddingHorizontal: spacing.md, marginTop: spacing.xl },
});
