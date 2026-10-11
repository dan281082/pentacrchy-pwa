import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { ProductCardSkeleton } from "@/src/components/ui/Skeleton";
import { TopBar } from "@/src/components/ui/TopBar";
import { useOrders } from "@/src/hooks/use-orders";
import type { Order, OrderStatus } from "@/src/types/order";
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

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const preview = order.lines.slice(0, 3);
  return (
    <Pressable
      testID={`order-card-${order.id}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardNumber}>#{order.number}</Text>
          {!!order.fulfilment && order.status === "processing" && (
            <Text style={styles.cardDate} testID={`order-fulfil-state-${order.id}`}>{order.fulfilment.stateLabel}</Text>
          )}
          <Text style={styles.cardDate}>{formatDate(order.dateCreated)}</Text>
        </View>
        <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[order.status] }]}>
          <Text style={styles.statusText}>{STATUS_LABEL[order.status]}</Text>
        </View>
      </View>

      <View style={styles.thumbs}>
        {preview.map((l) => (
          <View key={l.id} style={styles.thumbWrap}>
            {l.image ? (
              <Image source={l.image} contentFit="cover" style={styles.thumb} />
            ) : (
              <Ionicons name="cube-outline" size={18} color={colors.onSurfaceTertiary} />
            )}
          </View>
        ))}
        {order.itemCount > preview.length && (
          <View style={styles.thumbMore}>
            <Text style={styles.thumbMoreText}>+{order.itemCount - preview.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.cardTotal}>{order.total}</Text>
        <View style={styles.cardLink}>
          <Text style={styles.cardLinkText}>
            {order.fulfilment?.canUpload && !order.fulfilment.label ? "Provide shipping label" : "View details"}
          </Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brandSecondary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function OrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const query = useOrders();

  return (
    <View style={styles.container} testID="orders-screen">
      <TopBar title="My Orders" showBasket />

      {query.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </View>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          testID="orders-empty"
          icon="receipt-outline"
          title="No orders yet"
          message="Vials you order will appear here with live tracking."
          actionLabel="Browse vials"
          onAction={() => router.replace("/(tabs)/shop")}
        />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl }}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={query.refetch}
              tintColor={colors.brandSecondary}
            />
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push({ pathname: "/order/[id]", params: { id: String(item.id) } })}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  card: {
    backgroundColor: colors.surfaceSecondary, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md,
  },
  pressed: { backgroundColor: colors.surfaceTertiary },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  cardNumber: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  cardDate: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  statusPill: { borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  statusText: { color: colors.onSurface, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  thumbs: { flexDirection: "row", gap: spacing.sm },
  thumbWrap: {
    width: 48, height: 48, borderRadius: radius.sm, overflow: "hidden",
    backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center",
  },
  thumb: { width: "100%", height: "100%" },
  thumbMore: {
    width: 48, height: 48, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary,
    alignItems: "center", justifyContent: "center",
  },
  thumbMoreText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  cardFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.md,
  },
  cardTotal: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  cardLink: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  cardLinkText: { color: colors.brandSecondary, fontSize: fontSize.base, fontWeight: fontWeight.medium },
});
