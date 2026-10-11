import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductRail } from "@/src/components/product/ProductRail";
import { InstallHint } from "@/src/components/pwa/InstallHint";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { TopBar } from "@/src/components/ui/TopBar";
import { env } from "@/src/config/env";
import { useProducts, useProductsByIds } from "@/src/hooks/use-catalogue";
import { useHistoryStore } from "@/src/store/history-store";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

// Promo banner — sourced from app config in Phase 2 (Apeps App Connector).
const PROMO = {
  image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=1000&q=80",
  eyebrow: "MEMBERS ONLY",
  title: "Surplus vials,\nwhile stock lasts",
  cta: "Browse vials",
};

function HeroBanner() {
  const router = useRouter();
  return (
    <Pressable
      testID="home-hero-banner"
      onPress={() => router.push("/(tabs)/shop")}
      style={styles.hero}
    >
      <Image source={PROMO.image} contentFit="cover" style={StyleSheet.absoluteFill} transition={250} />
      <LinearGradient colors={["rgba(18,18,20,0.2)", "rgba(18,18,20,0.92)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.heroBody}>
        <Text style={styles.heroEyebrow}>{PROMO.eyebrow}</Text>
        <Text style={styles.heroTitle}>{PROMO.title}</Text>
        <View style={styles.heroCta}>
          <Text style={styles.heroCtaText}>{PROMO.cta}</Text>
          <Ionicons name="arrow-forward" size={16} color={colors.onBrandPrimary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const available = useProducts({ inStockOnly: true, perPage: 12 });
  const viewedIds = useHistoryStore((s) => s.viewedIds);
  const recentlyViewed = useProductsByIds(viewedIds);

  const openSupport = () => {
    WebBrowser.openBrowserAsync(env.supportUrl).catch(() => {});
  };

  const hardError = available.isError;

  return (
    <View style={styles.container} testID="home-screen">
      <TopBar showLogo showSearch />

      {hardError ? (
        <ErrorState error={available.error} onRetry={() => { available.refetch(); }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing["2xl"] }}
        >
          <View style={styles.heroWrap}>
            <HeroBanner />
          </View>

          <ProductRail
            title="Available now"
            products={available.data?.items ?? []}
            loading={available.isLoading}
            onSeeAll={() => router.push("/(tabs)/shop")}
            testID="home-available-rail"
          />
          {viewedIds.length > 0 && (
            <ProductRail
              title="Recently viewed"
              products={recentlyViewed.data ?? []}
              loading={recentlyViewed.isLoading}
              testID="home-recent-rail"
            />
          )}

          <InstallHint />

          {/* Support shortcut card */}
          <Pressable testID="home-support-card" onPress={openSupport} style={styles.supportCard}>
            <View style={styles.supportIcon}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.brandSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Need a hand?</Text>
              <Text style={styles.supportSub}>Contact Pentarchy support</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.onSurfaceTertiary} />
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  heroWrap: { padding: spacing.lg },
  hero: { height: 220, borderRadius: radius.lg, overflow: "hidden", justifyContent: "flex-end" },
  heroBody: { padding: spacing.lg, gap: spacing.sm },
  heroEyebrow: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, letterSpacing: 2, fontWeight: fontWeight.medium },
  heroTitle: { color: colors.onSurface, fontSize: fontSize["2xl"], fontWeight: fontWeight.medium, lineHeight: 30 },
  heroCta: {
    marginTop: spacing.sm, alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.brandPrimary, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm,
  },
  heroCtaText: { color: colors.onBrandPrimary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  section: { marginBottom: spacing.xl },
  catRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  supportCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    marginHorizontal: spacing.lg, padding: spacing.lg,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border,
  },
  supportIcon: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandTertiary,
    alignItems: "center", justifyContent: "center",
  },
  supportTitle: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  supportSub: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
});
