import { Image } from "expo-image";
import { useLocalSearchParams } from "expo-router";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ShippingLabelSection } from "@/src/components/orders/ShippingLabelSection";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { TopBar } from "@/src/components/ui/TopBar";
import { useOrder } from "@/src/hooks/use-orders";
import type { OrderStatus } from "@/src/types/order";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Pending payment",
  processing: "Processing",
  "on-hold": "On hold",
  completed: "Completed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  failed: "Failed",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: colors.warning,
  processing: colors.brandSecondary,
  "on-hold": colors.warning,
  completed: colors.success,
  cancelled: colors.onSurfaceTertiary,
  refunded: colors.onSurfaceTertiary,
  failed: colors.error,
};

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const query = useOrder(Number(id));
  const order = query.data;

  if (query.isLoading) {
    return (
      <View style={styles.container} testID="order-detail-loading">
        <TopBar title="Order" showBack showBasket={false} />
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Skeleton width="60%" height={22} />
          <Skeleton width="100%" height={80} rounded={radius.md} />
          <Skeleton width="100%" height={160} rounded={radius.md} />
        </View>
      </View>
    );
  }

  if (query.isError || !order) {
    return (
      <View style={styles.container}>
        <TopBar title="Order" showBack showBasket={false} />
        <ErrorState error={query.error} title="Order unavailable" onRetry={() => query.refetch()} />
      </View>
    );
  }

  return (
    <View style={styles.container} testID="order-detail-screen">
      <TopBar title={`Order #${order.number}`} showBack showBasket={false} />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor={colors.brandPrimary}
            colors={[colors.brandPrimary]}
          />
        }
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}
      >
        {/* Summary */}
        <View style={styles.card}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryDate}>{formatDate(order.dateCreated)}</Text>
            <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[order.status] }]}>
              <Text style={styles.statusText}>{STATUS_LABEL[order.status]}</Text>
            </View>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>
              {order.itemCount} item{order.itemCount === 1 ? "" : "s"}
            </Text>
            <Text style={styles.totalValue}>{order.total}</Text>
          </View>
        </View>

        {/* Customer-supplied postage label */}
        <ShippingLabelSection order={order} />

        {/* Items */}
        <View>
          <Text style={styles.sectionTitle}>Items</Text>
          <View style={styles.card}>
            {order.lines.map((line) => (
              <View key={line.id} style={styles.line} testID={`order-line-${line.id}`}>
                <View style={styles.lineImageWrap}>
                  {line.image ? (
                    <Image source={line.image} contentFit="cover" style={styles.lineImage} />
                  ) : (
                    <Ionicons name="cube-outline" size={22} color={colors.onSurfaceTertiary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.lineName} numberOfLines={2}>{line.name}</Text>
                  <Text style={styles.lineQty}>Qty {line.quantity}</Text>
                </View>
                <Text style={styles.lineTotal}>{line.total}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md,
  },
  summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  summaryDate: { color: colors.onSurfaceSecondary, fontSize: fontSize.base },
  statusPill: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  totalRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md },
  totalLabel: { color: colors.onSurfaceTertiary, fontSize: fontSize.base },
  totalValue: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium },
  sectionTitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 1, textTransform: "uppercase", marginBottom: spacing.sm, marginLeft: spacing.xs },
  line: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  lineImageWrap: { width: 56, height: 56, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  lineImage: { width: "100%", height: "100%" },
  lineName: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  lineQty: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  lineTotal: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
});
