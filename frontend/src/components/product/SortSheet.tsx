import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import { forwardRef, useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { SortOption } from "@/src/types/catalogue";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "newest", label: "Newest" },
  { key: "price-asc", label: "Price: low to high" },
  { key: "price-desc", label: "Price: high to low" },
  { key: "popularity", label: "Best selling" },
  { key: "alphabetical", label: "Alphabetical" },
];

export const sortLabel = (key: SortOption) =>
  SORT_OPTIONS.find((o) => o.key === key)?.label ?? "Recommended";

export const SortSheet = forwardRef<
  BottomSheetModal,
  { value: SortOption; onSelect: (v: SortOption) => void }
>(({ value, onSelect }, ref) => {
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.6} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      enableDynamicSizing
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.sheetBg}
      handleIndicatorStyle={styles.handle}
    >
      <BottomSheetView style={styles.sheetContent}>
        <Text style={styles.sheetTitle}>Sort by</Text>
        {SORT_OPTIONS.map((opt) => {
          const selected = opt.key === value;
          return (
            <Pressable
              key={opt.key}
              testID={`sort-option-${opt.key}`}
              onPress={() => onSelect(opt.key)}
              style={styles.optionRow}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
                {opt.label}
              </Text>
              {selected && <Ionicons name="checkmark" size={20} color={colors.brandSecondary} />}
            </Pressable>
          );
        })}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

SortSheet.displayName = "SortSheet";

const styles = StyleSheet.create({
  sheetBg: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg },
  handle: { backgroundColor: colors.borderStrong, width: 40 },
  sheetContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing["2xl"], paddingTop: spacing.sm },
  sheetTitle: { color: colors.onSurface, fontSize: fontSize.xl, fontWeight: fontWeight.medium, marginBottom: spacing.md },
  optionRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border,
  },
  optionText: { color: colors.onSurfaceSecondary, fontSize: fontSize.lg },
  optionTextSelected: { color: colors.onSurface, fontWeight: fontWeight.medium },
});
