// "Certificate of Analysis (COA)" row on the product page. Rendered only when
// the product has a COA; kept separate from the description and main image.
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fetchCoaFile, openCoaPdf, openCoaUrl } from "@/src/api/glp/coa";
import type { ProductCoa } from "@/src/types/catalogue";
import { colors, spacing, fontSize, fontWeight } from "@/src/theme";

export function CoaSection({ productId, coa }: { productId: number; coa: ProductCoa | null | undefined }) {
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [img, setImg] = useState<string | null>(null);
  if (!coa) return null;

  const open = async () => {
    setErr(null);
    if (coa.type === "url") { await openCoaUrl(coa.url); return; }
    const isPdf = coa.mime === "application/pdf";
    // Open the tab synchronously so web popup blockers allow it.
    const tab = Platform.OS === "web" && isPdf ? window.open("", "_blank") : null;
    setBusy(true);
    try {
      const f = await fetchCoaFile(productId);
      if (f.mime === "application/pdf") await openCoaPdf(f, tab);
      else { tab?.close(); setImg(`data:${f.mime};base64,${f.data}`); }
    } catch (e: any) { tab?.close(); setErr(e?.message ?? "Couldn't open the certificate."); }
    finally { setBusy(false); }
  };

  return (
    <View style={styles.wrap} testID="product-coa-section">
      <Pressable onPress={open} style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]} accessibilityRole="button" testID="product-coa-button">
        <Ionicons name="ribbon-outline" size={20} color={colors.brandSecondary} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Certificate of Analysis (COA)</Text>
          <Text style={styles.sub}>{coa.type === "url" ? "View lab certificate" : coa.mime === "application/pdf" ? "View PDF certificate" : "View certificate image"}</Text>
        </View>
        {busy ? <ActivityIndicator color={colors.brandSecondary} /> : <Ionicons name={coa.type === "url" ? "open-outline" : "chevron-forward"} size={18} color={colors.onSurfaceTertiary} />}
      </Pressable>
      {!!err && <Text style={styles.err} testID="product-coa-error">{err}</Text>}
      <Modal visible={!!img} transparent animationType="fade" onRequestClose={() => setImg(null)}>
        <View style={styles.viewer} testID="product-coa-viewer">
          <Pressable onPress={() => setImg(null)} style={[styles.close, { top: insets.top + spacing.md }]} testID="product-coa-close" accessibilityLabel="Close certificate">
            <Ionicons name="close" size={28} color={colors.onSurface} />
          </Pressable>
          {img && <Image source={img} contentFit="contain" style={StyleSheet.absoluteFill} />}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: spacing.sm },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, minHeight: 56, paddingVertical: spacing.sm },
  title: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  sub: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  err: { color: colors.error, fontSize: fontSize.sm },
  viewer: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)" },
  close: { position: "absolute", right: spacing.lg, zIndex: 2, width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
