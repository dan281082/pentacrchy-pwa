import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { catalogue } from "@/src/api/catalogue";
import { Button } from "@/src/components/ui/Button";
import { env } from "@/src/config/env";
import { useAuth } from "@/src/context/auth";
import { useNetwork } from "@/src/context/network";
import { qk } from "@/src/hooks/use-catalogue";
import { useBasketStore } from "@/src/store/basket-store";
import { useFavouritesStore } from "@/src/store/favourites-store";
import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

const SPLASH_BG =
  "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=800&q=80";
const MIN_SPLASH_MS = 1100;

function waitForHydration(store: { persist: any }): Promise<void> {
  return new Promise((resolve) => {
    if (store.persist.hasHydrated()) return resolve();
    const unsub = store.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

export default function Splash() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { isOnline } = useNetwork();
  const { status } = useAuth();
  const [failed, setFailed] = useState(false);
  const [storesReady, setStoresReady] = useState(false);
  const startedAt = useRef(Date.now());

  const bootstrap = useCallback(async () => {
    setFailed(false);
    startedAt.current = Date.now();
    try {
      // 1) Restore persisted basket + favourites.
      await Promise.all([
        waitForHydration(useBasketStore),
        waitForHydration(useFavouritesStore),
      ]);

      // 2) Warm essential home data (non-blocking of navigation on failure).
      await queryClient
        .prefetchQuery({ queryKey: qk.categories, queryFn: () => catalogue.getCategories() })
        .catch(() => {});

      // 3) Respect a minimum splash duration so it never flashes.
      const elapsed = Date.now() - startedAt.current;
      if (elapsed < MIN_SPLASH_MS) await new Promise((r) => setTimeout(r, MIN_SPLASH_MS - elapsed));

      setStoresReady(true);
    } catch {
      setFailed(true);
    }
  }, [queryClient]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  // Route once both local stores AND the auth session have resolved.
  useEffect(() => {
    if (!storesReady || status === "loading") return;
    if (status === "ready") router.replace("/(tabs)");
    else if (status === "pending") router.replace("/pending");
    else router.replace("/(auth)/login");
  }, [storesReady, status, router]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Image source={SPLASH_BG} contentFit="cover" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["rgba(18,18,20,0.7)", "rgba(18,18,20,0.98)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.center}>
        <View style={styles.wordmark}>
          <Text style={styles.wordmarkText}>PENTARCHY</Text>
          <View style={styles.dot} />
        </View>
        <Text style={styles.tagline}>{env.appName}</Text>
      </View>

      <View style={styles.footer}>
        {failed ? (
          <View style={styles.retry} testID="splash-retry">
            <Text style={styles.retryText}>
              {isOnline ? "We couldn’t start the app." : "You appear to be offline."}
            </Text>
            <Button title="Retry" icon="refresh" onPress={bootstrap} fullWidth={false} testID="splash-retry-button" />
          </View>
        ) : (
          <ActivityIndicator color={colors.brandSecondary} testID="splash-spinner" />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordmark: { flexDirection: "row", alignItems: "flex-start" },
  wordmarkText: { color: colors.onSurface, fontSize: 44, fontWeight: fontWeight.medium, letterSpacing: 6 },
  dot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brandPrimary, marginTop: 10, marginLeft: 4 },
  tagline: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, marginTop: spacing.sm, letterSpacing: 1 },
  footer: { paddingBottom: spacing["3xl"], alignItems: "center", minHeight: 80, justifyContent: "flex-end" },
  retry: { alignItems: "center", gap: spacing.md },
  retryText: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
});
