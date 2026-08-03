import { ScrollView } from "react-native";

import { useNetwork } from "@/src/context/network";
import { deriveModuleStatus } from "@/src/modules/shared/derive-status";
import { ModuleStateView } from "@/src/modules/shared/ModuleStateView";
import { useModuleAuth } from "@/src/modules/shared/use-module-auth";

import { TrackingHeader } from "../components/TrackingHeader";
import { TrackingTimeline } from "../components/TrackingTimeline";
import { useOrderTracking } from "../hooks";

// Live tracking screen. Opened with an orderId (from an order) in Phase 2. When
// hosted generically with no order selected, it shows a clear empty prompt.
export function LiveTrackingScreen({ orderId = null }: { orderId?: number | null }) {
  const { isAuthenticated } = useModuleAuth();
  const { isOnline } = useNetwork();
  const q = useOrderTracking(orderId);

  const status = deriveModuleStatus({
    isAuthenticated,
    isOnline,
    isLoading: !!orderId && q.isLoading,
    isError: q.isError,
    isEmpty: !orderId, // no order selected
  });

  return (
    <ModuleStateView
      status={status}
      error={q.error}
      onRetry={() => q.refetch()}
      emptyIcon="location-outline"
      emptyTitle="No order selected"
      emptyMessage="Open tracking from one of your orders to follow the delivery."
      testID="tracking-state"
    >
      {q.data && (
        <ScrollView testID="live-tracking-screen">
          <TrackingHeader tracking={q.data} />
          <TrackingTimeline events={q.data.events} />
        </ScrollView>
      )}
    </ModuleStateView>
  );
}
