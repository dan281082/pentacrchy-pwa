import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CategoryCard } from "@/src/components/product/CategoryCard";
import { ProductRail } from "@/src/components/product/ProductRail";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { SectionHeader } from "@/src/components/ui/SectionHeader";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { TopBar } from "@/src/components/ui/TopBar";
import { env } from "@/src/config/env";
import {
  useCategories,
  useProducts,
  useProductsByIds,
} from "@/src/hooks/use-catalogue";
import { useHistoryStore } from "@/src/store/history-store";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

// Promo banner — sourced from app config in Phase 2 (Apeps App Connector).
const PROMO = {
  image: "https://images.unsplash.com/photo-1769594362058-d561f024a235?w=1000&q=80",
  eyebrow: "APEPS SUPPLIES",
  title: "Everyday essentials,\ndelivered fast",
  cta: "Shop now",
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
  const categories = useCategories();
  const featured = useProducts({ featured: true, perPage: 10 });
  const newest = useProducts({ sort: "newest", perPage: 10 });
  const best = useProducts({ sort: "popularity", perPage: 10 });
  const viewedIds = useHistoryStore((s) => s.viewedIds);
  const recentlyViewed = useProductsByIds(viewedIds);

  const openSupport = () => {
    WebBrowser.openBrowserAsync(env.supportUrl).catch(() => {});
  };

  const hardError = categories.isError && featured.isError;

  return (
    <View style={styles.container} testID="home-screen">
      <TopBar showLogo showSearch />

      {hardError ? (
        <ErrorState error={categories.error} onRetry={() => { categories.refetch(); featured.refetch(); }} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + spacing["2xl"] }}
        >
          <View style={styles.heroWrap}>
            <HeroBanner />
          </View>

          {/* Shop by category */}
          <View style={styles.section}>
            <SectionHeader
              title="Shop by category"
              actionLabel="All"
              onAction={() => router.push("/(tabs)/shop")}
              testID="home-categories-header"
            />
            {categories.isLoading ? (
              <View style={styles.catRow}>
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} width={130} height={150} rounded={radius.md} />
                ))}
              </View>
            ) : (
              <FlatList
                data={categories.data ?? []}
                keyExtractor={(c) => String(c.id)}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catRow}
                renderItem={({ item }) => <CategoryCard category={item} />}
              />
            )}
          </View>

          <ProductRail
            title="Featured"
            products={featured.data?.items ?? []}
            loading={featured.isLoading}
            onSeeAll={() => router.push("/(tabs)/shop")}
            testID="home-featured-rail"
          />
          <ProductRail
            title="New in"
            products={newest.data?.items ?? []}
            loading={newest.isLoading}
            onSeeAll={() => router.push({ pathname: "/(tabs)/shop", params: { sort: "newest" } })}
            testID="home-new-rail"
          />
          <ProductRail
            title="Best sellers"
            products={best.data?.items ?? []}
            loading={best.isLoading}
            onSeeAll={() => router.push({ pathname: "/(tabs)/shop", params: { sort: "popularity" } })}
            testID="home-best-rail"
          />
          {viewedIds.length > 0 && (
            <ProductRail
              title="Recently viewed"
              products={recentlyViewed.data ?? []}
              loading={recentlyViewed.isLoading}
              testID="home-recent-rail"
            />
          )}

          {/* Support shortcut card */}
          <Pressable testID="home-support-card" onPress={openSupport} style={styles.supportCard}>
            <View style={styles.supportIcon}>
              <Ionicons name="chatbubbles-outline" size={22} color={colors.brandSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.supportTitle}>Need a hand?</Text>
              <Text style={styles.supportSub}>Contact Apeps customer support</Text>
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
