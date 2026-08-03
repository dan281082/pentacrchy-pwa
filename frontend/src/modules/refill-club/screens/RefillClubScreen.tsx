import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useNetwork } from "@/src/context/network";
import { deriveModuleStatus } from "@/src/modules/shared/derive-status";
import { ModuleStateView } from "@/src/modules/shared/ModuleStateView";
import { PreferenceToggleRow } from "@/src/modules/notification-centre/components/PreferenceToggleRow";
import { useModuleAuth } from "@/src/modules/shared/use-module-auth";
import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

import { RefillItemRow } from "../components/RefillItemRow";
import { useRefillPlans, useRefillPreferences, useUpdateRefillPreferences } from "../hooks";

// Refill Club scaffold. Reminder preferences only — no charges, no automatic
// ordering, no medical/dosage wording. Consent-gated and OFF by default.
export function RefillClubScreen() {
  const { isAuthenticated } = useModuleAuth();
  const { isOnline } = useNetwork();
  const prefs = useRefillPreferences();
  const plans = useRefillPlans();
  const update = useUpdateRefillPreferences();

  const status = deriveModuleStatus({
    isAuthenticated,
    isOnline,
    isLoading: prefs.isLoading,
    isError: prefs.isError,
    isEmpty: !prefs.data,
  });

  const set = (key: "enabled" | "reminderConsent", value: boolean) => {
    if (!prefs.data) return;
    update.mutate({ ...prefs.data, [key]: value });
  };

  return (
    <ModuleStateView status={status} error={prefs.error} onRetry={() => prefs.refetch()} testID="refill-state">
      {prefs.data && (
        <ScrollView testID="refill-club-screen">
          <Text style={styles.intro}>
            Set optional reminders to reorder products you buy regularly. Reminders only — nothing is
            ordered or charged automatically. You can turn these off at any time.
          </Text>

          <PreferenceToggleRow
            label="Enable Refill Club"
            description="Show refill reminders in the app."
            value={prefs.data.enabled}
            onValueChange={(v) => set("enabled", v)}
            testID="refill-enabled"
          />
          <PreferenceToggleRow
            label="Reminder consent"
            description="You previously ordered this product. Reorder is available."
            value={prefs.data.reminderConsent}
            onValueChange={(v) => set("reminderConsent", v)}
            testID="refill-consent"
          />

          <Text style={styles.sectionTitle}>Your refill reminders</Text>
          {(plans.data?.length ?? 0) === 0 ? (
            <Text style={styles.empty} testID="refill-plans-empty">
              You don’t have any refill reminders yet.
            </Text>
          ) : (
            <View testID="refill-plans">
              {plans.data!.map((p) => (
                <RefillItemRow key={p.id} plan={p} />
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </ModuleStateView>
  );
}

const styles = StyleSheet.create({
  intro: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 21, padding: spacing.lg },
  sectionTitle: {
    color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium,
    letterSpacing: 1, textTransform: "uppercase", paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm,
  },
  empty: { color: colors.onSurfaceTertiary, fontSize: fontSize.base, padding: spacing.lg },
});
