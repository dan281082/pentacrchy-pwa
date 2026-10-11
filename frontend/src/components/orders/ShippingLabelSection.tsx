// Customer "Provide Shipping Label" section on an order. Upload / view /
// replace a PDF or image postage label, or a JPG/PNG postage QR code, until the
// order is dispatched. All rules are enforced server-side; this is UX only.

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { glpLabels } from "@/src/api/glp/orders";
import { GlpError } from "@/src/api/glp/client";
import { Button } from "@/src/components/ui/Button";
import { orderKeys } from "@/src/hooks/use-orders";
import type { LabelKind, Order } from "@/src/types/order";
import { LabelPickError, pickLabelFile } from "@/src/utils/label-file";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

import { LabelViewer } from "./LabelViewer";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export function ShippingLabelSection({ order }: { order: Order }) {
  const qc = useQueryClient();
  const f = order.fulfilment;
  const [kind, setKind] = useState<LabelKind>(f?.label?.kind ?? "label");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replacing, setReplacing] = useState(false);

  if (order.status === "pending" || order.status === "on-hold") {
    return (
      <Section>
        <Info icon="time-outline" text="Once your payment is confirmed you can upload your postage label or QR code here." />
      </Section>
    );
  }
  if (!f) return null;

  const upload = async () => {
    setError(null);
    try {
      const picked = await pickLabelFile(kind);
      if (!picked) return;
      setUploading(true);
      const updated = await glpLabels.upload(order.id, { kind, filename: picked.name, data: picked.data });
      qc.setQueryData(orderKeys.detail(order.id), updated);
      qc.invalidateQueries({ queryKey: orderKeys.all });
      setReplacing(false);
    } catch (e) {
      setError(e instanceof LabelPickError || e instanceof GlpError ? e.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const dispatched = f.state === "dispatched";
  const showUploader = f.canUpload && (!f.label || replacing);

  return (
    <Section badge={f.stateLabel}>
      {dispatched ? (
        <Info icon="checkmark-circle" color={colors.success} text={`Dispatched${f.dispatchedAt ? ` on ${formatDate(f.dispatchedAt)}` : ""} using your postage. The label can no longer be changed.`} testID="label-locked" />
      ) : !f.label ? (
        <Text style={styles.body}>
          We post your vials using your own postage. Upload a PDF or photo of your postage label, or a postage QR code (JPG/PNG, max 5 MB).
        </Text>
      ) : null}

      {f.label && (
        <LabelViewer label={f.label} load={() => glpLabels.get(order.id)} orderNumber={order.number} testID="customer-label" />
      )}

      {showUploader ? (
        <View style={{ gap: spacing.md }} testID="label-uploader">
          <View style={styles.segment}>
            {(["label", "qr"] as LabelKind[]).map((k) => (
              <Pressable
                key={k}
                onPress={() => setKind(k)}
                style={[styles.segItem, kind === k && styles.segItemOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: kind === k }}
                testID={`label-kind-${k}`}
              >
                <Ionicons name={k === "qr" ? "qr-code-outline" : "document-text-outline"} size={16} color={kind === k ? colors.onSurface : colors.onSurfaceTertiary} />
                <Text style={[styles.segText, kind === k && styles.segTextOn]}>{k === "qr" ? "Postage QR code" : "Postage label"}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.hint}>{kind === "qr" ? "JPG or PNG image of the QR code" : "PDF, JPG or PNG"} · max 5 MB</Text>
          <Button
            title={f.label ? "Choose replacement file" : "Upload postage file"}
            icon="cloud-upload-outline"
            onPress={upload}
            loading={uploading}
            testID="label-upload-button"
          />
          {replacing && <Button title="Keep current file" variant="ghost" onPress={() => setReplacing(false)} testID="label-cancel-replace" />}
        </View>
      ) : (
        f.label && f.canUpload && (
          <Button title="Replace file" icon="swap-horizontal-outline" variant="ghost" onPress={() => setReplacing(true)} testID="label-replace-button" />
        )
      )}

      {!!error && <Text style={styles.error} testID="label-error">{error}</Text>}
    </Section>
  );
}

function Section({ children, badge }: { children: React.ReactNode; badge?: string }) {
  return (
    <View testID="shipping-label-section">
      <View style={styles.titleRow}>
        <Text style={styles.sectionTitle}>Provide shipping label</Text>
        {!!badge && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Info({ icon, text, color = colors.onSurfaceTertiary, testID }: { icon: keyof typeof Ionicons.glyphMap; text: string; color?: string; testID?: string }) {
  return (
    <View style={styles.info} testID={testID}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.sm, marginHorizontal: spacing.xs },
  sectionTitle: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium, letterSpacing: 1, textTransform: "uppercase" },
  badge: { backgroundColor: colors.brandTertiary, borderRadius: radius.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  badgeText: { color: colors.onBrandTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  card: { backgroundColor: colors.surfaceSecondary, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  body: { color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 },
  hint: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm },
  segment: { flexDirection: "row", backgroundColor: colors.surfaceTertiary, borderRadius: radius.md, padding: 4, gap: 4 },
  segItem: { flex: 1, minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: radius.sm },
  segItemOn: { backgroundColor: colors.surfaceSecondary },
  segText: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, fontWeight: fontWeight.medium },
  segTextOn: { color: colors.onSurface },
  info: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  infoText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: fontSize.base, lineHeight: 20 },
  error: { color: colors.error, fontSize: fontSize.sm },
});
