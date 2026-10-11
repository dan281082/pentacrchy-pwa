// Staff activity: audit trail of product, stock, notify and member changes.
import { useQuery } from "@tanstack/react-query";
import { FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";

import { describeChange, glpManage } from "@/src/api/glp/manage";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { TopBar } from "@/src/components/ui/TopBar";
import { useAuth } from "@/src/context/auth";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function AuditScreen() {
  const { user } = useAuth();
  const q = useQuery({ queryKey: ["manage", "audit"], queryFn: () => glpManage.audit(), enabled: !!user?.manage, staleTime: 0 });
  return (
    <View style={s.c} testID="manage-audit-screen">
      <TopBar title="Staff activity" showBack showBasket={false} />
      {q.isError ? <ErrorState error={q.error} title="Couldn't load activity" onRetry={() => q.refetch()} /> : (
        <FlatList data={q.data ?? []} keyExtractor={(_, i) => String(i)} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={q.isLoading ? null : <EmptyState icon="time-outline" title="No activity yet" message="Staff changes will appear here." />}
          renderItem={({ item: a }) => (
            <View style={s.card}>
              <Text style={s.name}>{a.action.replace(/_/g, " ")}{a.name ? ` · ${a.name}` : ""}</Text>
              <Text style={s.meta}>{new Date(a.at).toLocaleString("en-GB")} · {a.by}</Text>
              {Object.entries(a.changes).map(([k, c]) => <Text key={k} style={s.meta}>{describeChange(k, c)}</Text>)}
            </View>
          )} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.surface },
  card: { padding: spacing.md, gap: 2, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  name: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium, textTransform: "capitalize" },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
});
