import * as Haptics from "expo-haptics";
import { Pressable, StyleSheet, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { useFavouritesStore } from "@/src/store/favourites-store";
import { colors } from "@/src/theme";

export function FavouriteButton({
  productId,
  size = 22,
  style,
  testID,
}: {
  productId: number;
  size?: number;
  style?: ViewStyle;
  testID?: string;
}) {
  const isFav = useFavouritesStore((s) => s.ids.includes(productId));
  const toggle = useFavouritesStore((s) => s.toggle);

  return (
    <Pressable
      testID={testID ?? `favourite-button-${productId}`}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        toggle(productId);
      }}
      hitSlop={8}
      style={[styles.btn, style]}
      accessibilityRole="button"
      accessibilityLabel={isFav ? "Remove from favourites" : "Add to favourites"}
      accessibilityState={{ selected: isFav }}
    >
      <Ionicons
        name={isFav ? "heart" : "heart-outline"}
        size={size}
        color={isFav ? colors.error : colors.onSurface}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(18,18,20,0.6)",
  },
});
