import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Category } from "@/src/types/catalogue";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

const BLURHASH = "L6Pj0^i_.AyE_3t7t7R**0o#DgR4";

// Compact category tile used in the Home "Shop by Category" rail.
export function CategoryCard({ category, testID }: { category: Category; testID?: string }) {
  const router = useRouter();
  return (
    <Pressable
      testID={testID ?? `category-card-${category.id}`}
      onPress={() => router.push(`/category/${category.id}`)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${category.name}, ${category.count} products`}
    >
      <Image
        source={category.image?.src}
        placeholder={BLURHASH}
        contentFit="cover"
        transition={200}
        style={StyleSheet.absoluteFill}
        accessibilityLabel={category.name}
      />
      <LinearGradient
        colors={["transparent", "rgba(18,18,20,0.9)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {category.name}
        </Text>
        <Text style={styles.count}>{category.count} items</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 130,
    height: 150,
    borderRadius: radius.md,
    overflow: "hidden",
    backgroundColor: colors.surfaceTertiary,
    justifyContent: "flex-end",
  },
  pressed: { opacity: 0.85 },
  body: { padding: spacing.md },
  name: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  count: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, marginTop: 2 },
});
