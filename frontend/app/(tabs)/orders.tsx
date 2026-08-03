import * as WebBrowser from "expo-web-browser";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Button } from "@/src/components/ui/Button";
import { TopBar } from "@/src/components/ui/TopBar";
import { env } from "@/src/config/env";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function OrdersScreen() {
  return (
    <View style={styles.container} testID="orders-screen">
      <TopBar title="Orders" showBasket />
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <Ionicons name="receipt-outline" size={40} color={colors.brandSecondary} />
        </View>
        <Text style={styles.title}>Sign in to view your orders</Text>
        <Text style={styles.message}>
          Order history, tracking and reordering arrive with secure customer sign-in in the next
          release (Apeps App Connector). Your WooCommerce orders remain the single source of truth.
        </Text>
        <View style={styles.actions}>
          <Button
            title="Manage orders on the website"
            icon="open-outline"
            onPress={() => WebBrowser.openBrowserAsync(`${env.websiteUrl}/my-account/orders`).catch(() => {})}
            testID="orders-website-button"
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
    width: 84, height: 84, borderRadius: 42, backgroundColor: colors.surfaceSecondary,
    alignItems: "center", justifyContent: "center", marginBottom: spacing.sm,
  },
  title: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium, textAlign: "center" },
  message: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, textAlign: "center", lineHeight: 21 },
  actions: { marginTop: spacing.md, alignSelf: "stretch" },
});
