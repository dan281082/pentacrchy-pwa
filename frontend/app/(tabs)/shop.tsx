import { useLocalSearchParams } from "expo-router";
import { View, StyleSheet } from "react-native";

import { ProductListing } from "@/src/components/product/ProductListing";
import { TopBar } from "@/src/components/ui/TopBar";
import type { SortOption } from "@/src/types/catalogue";
import { colors } from "@/src/theme";

export default function ShopScreen() {
  const { sort } = useLocalSearchParams<{ sort?: string }>();
  const initialSort = (sort as SortOption) || "recommended";

  return (
    <View style={styles.container} testID="shop-screen">
      <TopBar title="Available Vials" showSearch />
      <ProductListing initialSort={initialSort} testID="shop-listing" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
});
