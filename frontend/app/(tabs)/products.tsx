// Staff Products: search, status filters, stock & sales at a glance.
import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { glpManage, type ManagedProduct } from "@/src/api/glp/manage";
import { EmptyState } from "@/src/components/ui/EmptyState";
import { ErrorState } from "@/src/components/ui/ErrorState";
import { TopBar } from "@/src/components/ui/TopBar";
import { useAuth } from "@/src/context/auth";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

const FILTERS = [
  { key: "all", label: "All" }, { key: "publish", label: "Published" }, { key: "draft", label: "Drafts" },
  { key: "outofstock", label: "Out of stock" }, { key: "members", label: "Members-only" },
];

export default function ProductsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const q = useQuery({ queryKey: ["manage", "products", search, filter], queryFn: () => glpManage.products(search, filter), enabled: !!user?.manage, staleTime: 0 });

  if (!user?.manage) return <View style={styles.c}><TopBar title="Products" showBasket={false} /><EmptyState icon="lock-closed-outline" title="Staff only" message="Your account can't manage products." /></View>;

  const Row = ({ p }: { p: ManagedProduct }) => (
    <Pressable onPress={() => router.push({ pathname: "/manage/product/[id]", params: { id: String(p.id) } })} style={styles.card} testID={`manage-product-${p.id}`}>
      <View style={styles.thumb}>{p.imageUrl ? <Image source={p.imageUrl} style={{ width: "100%", height: "100%" }} contentFit="cover" /> : <Ionicons name="flask-outline" size={20} color={colors.onSurfaceTertiary} />}</View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.name} numberOfLines={1}>{p.name}</Text>
        <Text style={styles.meta}>£{p.salePrice || p.price || "—"} · {p.stockStatus === "outofstock" ? "Out of stock" : p.stockQuantity !== null ? `${p.stockQuantity} in stock` : "In stock"}</Text>
        <Text style={styles.meta}>Sold {p.sold30d} (30d) · {p.soldTotal} total</Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={[styles.pill, p.status === "publish" ? styles.pillOn : null]}>{p.status === "publish" ? "Published" : "Draft"}</Text>
        {p.membersOnly && <Text style={styles.meta}>Members</Text>}
      </View>
    </Pressable>
  );

  return (
    <View style={styles.c} testID="manage-products-screen">
      <TopBar title="Products" showBasket={false} />
      <View style={styles.tools}>
        <View style={styles.search}>
          <Ionicons name="search" size={16} color={colors.onSurfaceTertiary} />
          <TextInput value={search} onChangeText={setSearch} placeholder="Search products" placeholderTextColor={colors.onSurfaceTertiary} style={styles.input} testID="manage-search" />
        </View>
        <Pressable onPress={() => router.push({ pathname: "/manage/product/[id]", params: { id: "new" } })} style={styles.add} testID="manage-new-product"><Ionicons name="add" size={22} color={colors.onBrandPrimary} /></Pressable>
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipOn]} testID={`manage-filter-${f.key}`}>
              <Text style={[styles.chipText, filter === f.key && { color: colors.onBrandPrimary }]}>{f.label}</Text>
            </Pressable>
          ))}
          {user.members && <Pressable onPress={() => router.push("/manage/members")} style={styles.chip} testID="manage-members-link"><Text style={styles.chipText}>Members →</Text></Pressable>}
          <Pressable onPress={() => router.push("/manage/audit")} style={styles.chip} testID="manage-audit-link"><Text style={styles.chipText}>Activity →</Text></Pressable>
        </ScrollView>
      </View>
      {q.isError ? <ErrorState error={q.error} title="Couldn't load products" onRetry={() => q.refetch()} /> : (
        <FlatList data={q.data ?? []} keyExtractor={(p) => String(p.id)} renderItem={({ item }) => <Row p={item} />}
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, flexGrow: 1 }}
          refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} tintColor={colors.brandPrimary} />}
          ListEmptyComponent={q.isLoading ? null : <EmptyState icon="file-tray-outline" title="No products" message="Nothing matches this filter." />} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.surface },
  tools: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  search: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.onSurface, fontSize: fontSize.base },
  add: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  chip: { minHeight: 36, justifyContent: "center", paddingHorizontal: spacing.md, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  chipOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipText: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceSecondary },
  thumb: { width: 52, height: 52, borderRadius: radius.sm, overflow: "hidden", backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  name: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  meta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  pill: { color: colors.onSurfaceSecondary, fontSize: fontSize.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" },
  pillOn: { color: colors.success, borderColor: colors.success },
});
