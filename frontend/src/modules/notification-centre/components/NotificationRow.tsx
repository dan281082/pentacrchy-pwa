import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { AppNotification, NotificationCategory } from "../types";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

const ICONS: Record<NotificationCategory, keyof typeof Ionicons.glyphMap> = {
  order: "receipt-outline",
  tracking: "location-outline",
  restock: "cube-outline",
  offers: "pricetag-outline",
  loyalty: "sparkles-outline",
  reorder: "repeat-outline",
  "new-products": "star-outline",
  security: "lock-closed-outline",
};

export function NotificationRow({
  notification,
  read,
  onPress,
}: {
  notification: AppNotification;
  read: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`notification-row-${notification.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: !read }}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={ICONS[notification.category]} size={18} color={colors.brandSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.title, !read && styles.unread]} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>{notification.body}</Text>
        <Text style={styles.date}>{notification.createdAt.slice(0, 10)}</Text>
      </View>
      {!read && <View style={styles.dot} testID={`notification-unread-${notification.id}`} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", gap: spacing.md, alignItems: "center",
    paddingVertical: spacing.md, paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  pressed: { backgroundColor: colors.surfaceSecondary },
  iconWrap: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center",
  },
  title: { color: colors.onSurfaceSecondary, fontSize: fontSize.base },
  unread: { color: colors.onSurface, fontWeight: fontWeight.medium },
  body: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  date: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
});
