import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

import { ProductListing } from "@/src/components/product/ProductListing";
import { TopBar } from "@/src/components/ui/TopBar";
import { useCategory } from "@/src/hooks/use-catalogue";
import { stripHtml } from "@/src/utils/html";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function CategoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const category = useCategory(id);
  const cat = category.data;

  const banner = (
    <View style={styles.bannerWrap}>
      <View style={styles.banner}>
        {cat?.image?.src && (
          <Image source={cat.image.src} contentFit="cover" style={StyleSheet.absoluteFill} transition={200} />
        )}
        <LinearGradient colors={["rgba(18,18,20,0.35)", "rgba(18,18,20,0.95)"]} style={StyleSheet.absoluteFill} />
        <View style={styles.bannerBody}>
          <Text style={styles.bannerTitle}>{cat?.name ?? "Category"}</Text>
          {!!cat?.description && (
            <Text style={styles.bannerDesc} numberOfLines={2}>
              {stripHtml(cat.description)}
            </Text>
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container} testID="category-screen">
      <TopBar title={cat?.name ?? "Category"} showBack showSearch />
      <ProductListing
        lockedCategoryId={Number(id)}
        headerExtra={banner}
        testID="category-listing"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  bannerWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  banner: {
    height: 130, borderRadius: radius.lg, overflow: "hidden",
    backgroundColor: colors.surfaceTertiary, justifyContent: "flex-end",
  },
  bannerBody: { padding: spacing.lg, gap: spacing.xs },
  bannerTitle: { color: colors.onSurface, fontSize: fontSize["2xl"], fontWeight: fontWeight.medium },
  bannerDesc: { color: colors.onSurfaceSecondary, fontSize: fontSize.base },
});
