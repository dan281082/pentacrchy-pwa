import { useRouter } from "expo-router";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useNetwork } from "@/src/context/network";
import { deriveModuleStatus } from "@/src/modules/shared/derive-status";
import { ModuleStateView } from "@/src/modules/shared/ModuleStateView";
import { useModuleAuth } from "@/src/modules/shared/use-module-auth";
import { colors, spacing, radius, fontSize, fontWeight } from "@/src/theme";

import { NotificationRow } from "../components/NotificationRow";
import { PreferenceToggleRow } from "../components/PreferenceToggleRow";
import { routeForNotification } from "../deep-link";
import {
  useMarkRead,
  useNotificationPreferences,
  useNotifications,
  useUpdatePreferences,
} from "../hooks";
import { useNotificationStore } from "../store";
import type { NotificationPreferences } from "../types";

function Inbox() {
  const router = useRouter();
  const { isAuthenticated } = useModuleAuth();
  const { isOnline } = useNetwork();
  const q = useNotifications();
  const markRead = useMarkRead();
  const optimisticRead = useNotificationStore((s) => s.optimisticRead);

  const status = deriveModuleStatus({
    isAuthenticated,
    isOnline,
    isLoading: q.isLoading,
    isError: q.isError,
    isEmpty: (q.data?.length ?? 0) === 0,
  });

  return (
    <ModuleStateView
      status={status}
      error={q.error}
      onRetry={() => q.refetch()}
      emptyIcon="notifications-outline"
      emptyTitle="No notifications"
      emptyMessage="You’re all caught up. New updates will appear here."
      testID="notification-inbox-state"
    >
      <FlatList
        testID="notification-inbox"
        data={q.data ?? []}
        keyExtractor={(n) => n.id}
        renderItem={({ item }) => (
          <NotificationRow
            notification={item}
            read={item.read || optimisticRead.includes(item.id)}
            onPress={() => {
              markRead.mutate(item.id);
              const href = routeForNotification(item);
              if (href) router.push(href as any);
            }}
          />
        )}
      />
    </ModuleStateView>
  );
}

function Settings() {
  const { isAuthenticated } = useModuleAuth();
  const { isOnline } = useNetwork();
  const q = useNotificationPreferences();
  const update = useUpdatePreferences();

  const status = deriveModuleStatus({
    isAuthenticated,
    isOnline,
    isLoading: q.isLoading,
    isError: q.isError,
    isEmpty: !q.data,
  });

  const set = (key: keyof NotificationPreferences, value: boolean) => {
    if (!q.data) return;
    update.mutate({ ...q.data, [key]: value });
  };

  return (
    <ModuleStateView status={status} error={q.error} onRetry={() => q.refetch()} testID="notification-settings-state">
      {q.data && (
        <ScrollView testID="notification-settings">
          <Text style={styles.groupTitle}>Order updates</Text>
          <PreferenceToggleRow label="Order updates" description="Received, processing, dispatched, completed." value={q.data.orderUpdates} onValueChange={(v) => set("orderUpdates", v)} testID="pref-orderUpdates" />
          <PreferenceToggleRow label="Tracking updates" value={q.data.trackingUpdates} onValueChange={(v) => set("trackingUpdates", v)} testID="pref-trackingUpdates" />
          <Text style={styles.groupTitle}>Marketing (opt-in)</Text>
          <PreferenceToggleRow label="Restock alerts" value={q.data.restocks} onValueChange={(v) => set("restocks", v)} testID="pref-restocks" />
          <PreferenceToggleRow label="New products" value={q.data.newProducts} onValueChange={(v) => set("newProducts", v)} testID="pref-newProducts" />
          <PreferenceToggleRow label="Offers" value={q.data.offers} onValueChange={(v) => set("offers", v)} testID="pref-offers" />
          <PreferenceToggleRow label="Loyalty updates" value={q.data.loyalty} onValueChange={(v) => set("loyalty", v)} testID="pref-loyalty" />
          <PreferenceToggleRow label="Reorder reminders" description="You previously ordered this product. Reorder is available." value={q.data.reorderReminders} onValueChange={(v) => set("reorderReminders", v)} testID="pref-reorderReminders" />
          <Text style={styles.note}>Marketing notifications are off unless you turn them on.</Text>
        </ScrollView>
      )}
    </ModuleStateView>
  );
}

export function NotificationCentreScreen() {
  const tab = useNotificationStore((s) => s.activeTab);
  const setTab = useNotificationStore((s) => s.setTab);

  return (
    <View style={styles.container} testID="notification-centre-screen">
      <View style={styles.segment}>
        {(["inbox", "settings"] as const).map((t) => (
          <Pressable
            key={t}
            testID={`notification-tab-${t}`}
            onPress={() => setTab(t)}
            style={[styles.segmentBtn, tab === t && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, tab === t && styles.segmentTextActive]}>
              {t === "inbox" ? "Inbox" : "Settings"}
            </Text>
          </Pressable>
        ))}
      </View>
      {tab === "inbox" ? <Inbox /> : <Settings />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  segment: {
    flexDirection: "row", gap: spacing.sm, margin: spacing.lg, padding: 4,
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
  },
  segmentBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: colors.brandPrimary },
  segmentText: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  segmentTextActive: { color: colors.onBrandPrimary },
  groupTitle: {
    color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium,
    letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  note: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, padding: spacing.lg },
});
