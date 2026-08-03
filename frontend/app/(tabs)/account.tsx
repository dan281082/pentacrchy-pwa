import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TopBar } from "@/src/components/ui/TopBar";
import { env } from "@/src/config/env";
import { activeDataSource } from "@/src/api/catalogue";
import { useFavouritesStore } from "@/src/store/favourites-store";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

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
  const favCount = useFavouritesStore((s) => s.ids.length);
  const web = (path: string) => WebBrowser.openBrowserAsync(`${env.websiteUrl}${path}`).catch(() => {});

  return (
    <View style={styles.container} testID="account-screen">
      <TopBar title="Account" showBasket />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
        {/* Guest header */}
        <View style={styles.guest} testID="account-guest-card">
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={26} color={colors.onSurfaceSecondary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.guestTitle}>Welcome to {env.appName}</Text>
            <Text style={styles.guestSub}>Secure sign-in arrives in the next release.</Text>
          </View>
        </View>

        <Section title="Shopping">
          <Row icon="heart-outline" label="Favourites" value={favCount ? String(favCount) : undefined} onPress={() => router.push("/favourites")} testID="account-favourites" />
          <Row icon="bag-handle-outline" label="Basket" onPress={() => router.push("/basket")} testID="account-basket" />
          <Row icon="receipt-outline" label="Orders" onPress={() => router.push("/(tabs)/orders")} testID="account-orders" />
        </Section>

        <Section title="Support">
          <Row icon="help-circle-outline" label="Help & contact" onPress={() => WebBrowser.openBrowserAsync(env.supportUrl).catch(() => {})} testID="account-support" />
          {!!env.whatsappUrl && (
            <Row icon="logo-whatsapp" label="WhatsApp" onPress={() => WebBrowser.openBrowserAsync(env.whatsappUrl).catch(() => {})} testID="account-whatsapp" />
          )}
        </Section>

        <Section title="Legal & policies">
          <Row icon="document-text-outline" label="Terms & conditions" onPress={() => web("/terms")} testID="account-terms" />
          <Row icon="shield-checkmark-outline" label="Privacy policy" onPress={() => web("/privacy-policy")} testID="account-privacy" />
          <Row icon="cube-outline" label="Delivery policy" onPress={() => web("/delivery")} testID="account-delivery" />
          <Row icon="refresh-outline" label="Returns & refunds" onPress={() => web("/refund-policy")} testID="account-refunds" />
        </Section>

        <Section title="App">
          <Row icon="information-circle-outline" label="Version" value={env.currentVersion} onPress={() => {}} testID="account-version" />
          <View style={styles.row}>
            <Ionicons name="server-outline" size={20} color={colors.onSurfaceSecondary} />
            <Text style={styles.rowLabel}>Data source</Text>
            <View style={[styles.badge, activeDataSource === "live" ? styles.badgeLive : styles.badgeMock]}>
              <Text style={styles.badgeText}>{activeDataSource === "live" ? "LIVE (read-only)" : "MOCK DATA"}</Text>
            </View>
          </View>
        </Section>

        <Text style={styles.footer}>
          {activeDataSource === "live"
            ? "Catalogue is served read-only from WooCommerce. Checkout, accounts & orders arrive in Phase 2."
            : "Preview is running on realistic mock data. Set EXPO_PUBLIC_DATA_SOURCE=live to serve the real Apeps catalogue on device."}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  guest: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border,
    padding: spacing.lg, marginBottom: spacing.xl,
  },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  guestTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  guestSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
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
  badge: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeLive: { backgroundColor: colors.success },
  badgeMock: { backgroundColor: colors.surfaceTertiary },
  badgeText: { color: colors.onSurface, fontSize: 10, fontWeight: fontWeight.medium, letterSpacing: 0.5 },
  footer: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, lineHeight: 18, textAlign: "center", paddingHorizontal: spacing.md },
});
