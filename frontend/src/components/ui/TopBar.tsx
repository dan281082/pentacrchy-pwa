import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useBasketStore, selectItemCount } from "@/src/store/basket-store";
import { colors, spacing, fontSize, fontWeight, radius } from "@/src/theme";

// Pentarchy wordmark — swap for the real logo asset when supplied (single place).
function Wordmark() {
  return (
    <View style={styles.wordmark} accessibilityRole="header" accessibilityLabel="Pentarchy">
      <Text style={styles.wordmarkText}>PENTARCHY</Text>
      <View style={styles.dot} />
    </View>
  );
}

function BasketButton() {
  const router = useRouter();
  const count = useBasketStore(selectItemCount);
  return (
    <Pressable
      testID="topbar-basket-button"
      onPress={() => router.push("/basket")}
      hitSlop={8}
      style={styles.iconBtn}
      accessibilityRole="button"
      accessibilityLabel={`Basket, ${count} item${count === 1 ? "" : "s"}`}
    >
      <Ionicons name="bag-handle-outline" size={24} color={colors.onSurface} />
      {count > 0 && (
        <View style={styles.badge} testID="basket-badge">
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function TopBar({
  title,
  showLogo = false,
  showBack = false,
  showSearch = false,
  showBasket = true,
  testID = "top-bar",
}: {
  title?: string;
  showLogo?: boolean;
  showBack?: boolean;
  showSearch?: boolean;
  showBasket?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <BlurView intensity={40} tint="dark" style={[styles.container, { paddingTop: insets.top }]} testID={testID}>
      <View style={styles.bar}>
        <View style={styles.left}>
          {showBack && (
            <Pressable
              testID="topbar-back-button"
              onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)"))}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
            </Pressable>
          )}
          {showLogo && <Wordmark />}
          {!!title && (
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          )}
        </View>

        <View style={styles.right}>
          {showSearch && (
            <Pressable
              testID="topbar-search-button"
              onPress={() => router.push("/(tabs)/search")}
              hitSlop={8}
              style={styles.iconBtn}
              accessibilityRole="button"
              accessibilityLabel="Search"
            >
              <Ionicons name="search-outline" size={24} color={colors.onSurface} />
            </Pressable>
          )}
          {showBasket && <BasketButton />}
        </View>
      </View>
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: "rgba(18,18,20,0.8)",
  },
  bar: {
    height: 52,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  left: { flexDirection: "row", alignItems: "center", gap: spacing.xs, flex: 1 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium, flexShrink: 1 },
  wordmark: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm },
  wordmarkText: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium, letterSpacing: 2 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.brandPrimary, marginLeft: 3, marginTop: 6 },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  badgeText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: fontWeight.medium },
});
