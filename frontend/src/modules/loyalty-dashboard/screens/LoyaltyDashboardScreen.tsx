import { ScrollView } from "react-native";

import { useNetwork } from "@/src/context/network";
import { deriveModuleStatus } from "@/src/modules/shared/derive-status";
import { ModuleStateView } from "@/src/modules/shared/ModuleStateView";
import { useModuleAuth } from "@/src/modules/shared/use-module-auth";

import { ActivityList } from "../components/ActivityList";
import { PointsCard } from "../components/PointsCard";
import { useLoyaltySummary } from "../hooks";

// Loyalty dashboard screen. Reads the EXISTING loyalty system (Phase 2) — shows
// nothing fabricated. Until connected, resolves to unauthorised/empty.
export function LoyaltyDashboardScreen() {
  const { isAuthenticated } = useModuleAuth();
  const { isOnline } = useNetwork();
  const q = useLoyaltySummary();

  const status = deriveModuleStatus({
    isAuthenticated,
    isOnline,
    isLoading: q.isLoading,
    isError: q.isError,
    isEmpty: !q.data?.enabled || q.data?.points == null,
  });

  return (
    <ModuleStateView
      status={status}
      error={q.error}
      onRetry={() => q.refetch()}
      emptyIcon="sparkles-outline"
      emptyTitle="Loyalty not available yet"
      emptyMessage="Your loyalty balance will appear here once the loyalty system is connected."
      testID="loyalty-state"
    >
      {q.data && (
        <ScrollView testID="loyalty-dashboard-screen">
          <PointsCard summary={q.data} />
          <ActivityList activity={q.data.activity} />
        </ScrollView>
      )}
    </ModuleStateView>
  );
}
