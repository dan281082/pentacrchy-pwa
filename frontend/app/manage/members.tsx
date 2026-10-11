// Limited Members management: search, approval status, order count, approve/suspend.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { FlatList, StyleSheet, Switch, Text, TextInput, View } from "react-native";

import { glpManage } from "@/src/api/glp/manage";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { TopBar } from "@/src/components/ui/TopBar";
import { useAuth } from "@/src/context/auth";
import { confirmAction } from "@/src/utils/confirm";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export default function MembersScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["manage", "members", search], queryFn: () => glpManage.members(search), enabled: !!user?.members, staleTime: 0 });
  if (!user?.members) return <View style={s.c}><TopBar title="Members" showBack showBasket={false} /><EmptyState icon="lock-closed-outline" title="Staff only" message="Your account can't manage members." /></View>;

  const toggle = async (id: number, approved: boolean) => {
    setErr(null);
    if (!approved && !(await confirmAction("Suspend member?", "They will lose access to the storefront until re-approved.", "Suspend"))) return;
    try { await glpManage.setApproved(id, approved); qc.invalidateQueries({ queryKey: ["manage", "members"] }); } catch (e: any) { setErr(e?.message ?? "Couldn't update member."); }
  };
  return (
    <View style={s.c} testID="manage-members-screen">
      <TopBar title="Members" showBack showBasket={false} />
      <View style={{ padding: spacing.lg, paddingBottom: 0, gap: spacing.sm }}>
        <TextInput value={search} onChangeText={setSearch} placeholder="Search name, email or Telegram" placeholderTextColor={colors.onSurfaceTertiary} style={s.input} testID="members-search" />
        {!!err && <Text style={s.err}>{err}</Text>}
      </View>
      {q.isError ? <ErrorState error={q.error} title="Couldn't load members" onRetry={() => q.refetch()} /> : (
        <FlatList data={q.data ?? []} keyExtractor={(m) => String(m.id)} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm, flexGrow: 1 }}
          ListEmptyComponent={q.isLoading ? null : <EmptyState icon="people-outline" title="No members found" message="Try another search." />}
          renderItem={({ item: m }) => (
            <View style={s.card} testID={`member-${m.id}`}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={s.name}>{m.name || m.email}{m.staff ? "  · staff" : ""}</Text>
                <Text style={s.meta}>{m.email}{m.telegram ? ` · @${m.telegram.replace(/^@/, "")}` : ""}</Text>
                <Text style={s.meta}>{m.orders} order{m.orders === 1 ? "" : "s"} · joined {new Date(m.registered).toLocaleDateString("en-GB")} · {m.approved ? "Active" : "Suspended"}</Text>
              </View>
              <Switch value={m.approved} onValueChange={(v) => toggle(m.id, v)} trackColor={{ true: colors.brandPrimary, false: colors.surfaceTertiary }} testID={`member-toggle-${m.id}`} />
            </View>
          )} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.surface },
  input: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary, color: colors.onSurface, fontSize: fontSize.base },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  name: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  err: { color: colors.error, fontSize: fontSize.sm },
});
