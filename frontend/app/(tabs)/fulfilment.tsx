// Staff Fulfilment queue — visible only to accounts the server flags with the
// glp_fulfil_orders permission (all data access is enforced server-side too).

import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { FulfilmentSummary } from "@/src/api/glp/fulfilment";
import { FULFIL_LABEL, FULFIL_STATES, FulfilStatePill } from "@/src/components/fulfilment/FulfilState";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { Skeleton } from "@/src/components/ui/Skeleton";
import { TopBar } from "@/src/components/ui/TopBar";
import { useAuth } from "@/src/context/auth";
import { useFulfilmentOrders } from "@/src/hooks/use-fulfilment";
import type { FulfilmentState } from "@/src/types/order";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

type Filter = "active" | FulfilmentState;

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function Row({ o, onPress }: { o: FulfilmentSummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]} testID={`fulfil-order-${o.id}`}>
      <View style={styles.cardTop}>
        <Text style={styles.number}>#{o.number}</Text>
        <FulfilStatePill state={o.state} />
      </View>
      <Text style={styles.name} numberOfLines={1}>{o.customerName || "Customer"}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {o.itemCount} item{o.itemCount === 1 ? "" : "s"} · Paid {formatDate(o.datePaid ?? o.dateCreated)}
        </Text>
        {o.labelKind && (
          <View style={styles.kind}>
            <Ionicons name={o.labelKind === "qr" ? "qr-code-outline" : "document-text-outline"} size={14} color={colors.onSurfaceTertiary} />
            <Text style={styles.meta}>{o.labelKind === "qr" ? "QR" : "Label"}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={16} color={colors.onSurfaceTertiary} />
      </View>
    </Pressable>
  );
}

export default function FulfilmentScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const q = useFulfilmentOrders();
  const [filter, setFilter] = useState<Filter>("active");

  const [search, setSearch] = useState("");
  const data = useMemo(() => {
    const all = q.data?.orders ?? [];
    const byState = filter === "active" ? all.filter((o) => o.state !== "dispatched") : all.filter((o) => o.state === filter);
    const t = search.trim().toLowerCase().replace(/^[#@]/, "");
    return t ? byState.filter((o) => [o.number, o.customerName, o.telegram].some((v) => (v || "").toLowerCase().includes(t))) : byState;
  }, [q.data, filter, search]);

  if (!user?.fulfilment) {
    return (
      <View style={styles.container}>
        <TopBar title="Fulfilment" showBasket={false} />
        <EmptyState icon="lock-closed-outline" title="Staff only" message="Your account doesn't have fulfilment access." testID="fulfil-forbidden" />
      </View>
    );
  }

  const counts = q.data?.counts;
  const activeCount = counts ? counts.awaiting_label + counts.label_supplied + counts.ready : 0;
  const filters: { key: Filter; label: string; n?: number }[] = [
    { key: "active", label: "To do", n: activeCount },
    ...FULFIL_STATES.map((s) => ({ key: s as Filter, label: FULFIL_LABEL[s], n: counts?.[s] })),
  ];

  return (
    <View style={styles.container} testID="fulfilment-screen">
      <TopBar title="Fulfilment" showBasket={false} />
      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search order #, customer or @telegram" placeholderTextColor={colors.onSurfaceTertiary} style={styles.search} testID="fulfil-search" />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {filters.map((f) => {
            const on = f.key === filter;
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, on && styles.chipOn]} testID={`fulfil-filter-${f.key}`}>
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
                {f.n !== undefined && <Text style={[styles.chipCount, on && styles.chipTextOn]}>{f.n}</Text>}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {q.isLoading ? (
        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {[0, 1, 2].map((i) => <Skeleton key={i} width="100%" height={96} rounded={radius.md} />)}
        </View>
      ) : q.isError ? (
        <ErrorState error={q.error} title="Couldn't load fulfilment orders" onRetry={() => q.refetch()} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(o) => String(o.id)}
          renderItem={({ item }) => <Row o={item} onPress={() => router.push({ pathname: "/fulfilment/[id]", params: { id: String(item.id) } })} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: insets.bottom + spacing.xl, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} colors={[colors.brandPrimary]} />}
          ListEmptyComponent={
            <EmptyState icon="checkmark-done-outline" title="Nothing here" message={filter === "active" ? "No paid orders waiting for fulfilment." : `No orders in “${filters.find((f) => f.key === filter)?.label}”.`} testID="fulfil-empty" />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  search: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, color: colors.onSurface, fontSize: fontSize.base },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  chipTextOn: { color: colors.onBrandPrimary },
  chipCount: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: 6 },
  cardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  number: { color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  name: { color: colors.onSurfaceSecondary, fontSize: fontSize.base },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, flexShrink: 1 },
  kind: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
});
