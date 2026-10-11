// Shows an uploaded postage label / QR (fetched on demand from an authenticated
// endpoint). Images preview inline and open full-screen (QR codes shown large
// on a white background so they scan reliably). PDFs show a file card.
// Optional print / save actions for staff.

import { Image } from "expo-image";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/src/components/ui/Button";
import type { LabelFile, OrderLabel } from "@/src/types/order";
import { dataUri, formatBytes, isImage, openOrSaveLabel, printLabel } from "@/src/utils/label-file";
import { colors, radius, spacing, fontSize, fontWeight } from "@/src/theme";

export function LabelViewer({
  label,
  load,
  orderNumber,
  staffActions = false,
  testID = "label-viewer",
}: {
  label: OrderLabel;
  load: () => Promise<LabelFile>;
  orderNumber: string;
  staffActions?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  const [file, setFile] = useState<LabelFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"" | "print" | "save">("");
  const [error, setError] = useState<string | null>(null);
  const [full, setFull] = useState(false);

  // A replaced label has a new upload time → drop the cached copy.
  const current = file && file.uploadedAt === label.uploadedAt ? file : null;

  const ensure = async (): Promise<LabelFile | null> => {
    if (current) return current;
    setLoading(true);
    setError(null);
    try {
      const f = await load();
      setFile(f);
      return f;
    } catch (e: any) {
      setError(e?.message ?? "Could not load the file.");
      return null;
    } finally {
      setLoading(false);
    }
  };

  const run = async (kind: "print" | "save") => {
    const f = await ensure();
    if (!f) return;
    setBusy(kind);
    try {
      if (kind === "print") await printLabel(f, orderNumber);
      else await openOrSaveLabel(f, orderNumber);
    } catch (e: any) {
      setError(e?.message ?? "Action failed.");
    } finally {
      setBusy("");
    }
  };

  const isQr = label.kind === "qr";
  const image = isImage(label.mime);

  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <View style={styles.fileRow}>
        <View style={styles.fileIcon}>
          <Ionicons name={isQr ? "qr-code-outline" : image ? "image-outline" : "document-text-outline"} size={22} color={colors.brandSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.fileTitle}>{isQr ? "Postage QR code" : "Postage label"}</Text>
          <Text style={styles.fileMeta} numberOfLines={1}>
            {[label.filename, label.mime === "application/pdf" ? "PDF" : label.mime.replace("image/", "").toUpperCase(), formatBytes(label.size)]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>
      </View>

      {image && current ? (
        <Pressable onPress={() => setFull(true)} style={[styles.preview, isQr && styles.previewQr]} testID={`${testID}-preview`} accessibilityLabel="Show full screen">
          <Image source={{ uri: dataUri(current) }} contentFit="contain" style={styles.previewImg} />
          <View style={styles.expand}><Ionicons name="expand-outline" size={16} color={colors.onSurface} /></View>
        </Pressable>
      ) : null}

      {!!error && <Text style={styles.error}>{error}</Text>}

      <View style={styles.actions}>
        {image ? (
          <Button
            title={current ? (isQr ? "Show QR full screen" : "View full screen") : isQr ? "Show QR code" : "View label"}
            icon={isQr ? "qr-code-outline" : "eye-outline"}
            variant="secondary"
            loading={loading && !busy}
            onPress={async () => { const f = await ensure(); if (f) setFull(true); }}
            testID={`${testID}-view`}
          />
        ) : (
          <Button title="Open PDF label" icon="document-text-outline" variant="secondary" loading={busy === "save"} onPress={() => run("save")} testID={`${testID}-open`} />
        )}
        {staffActions && (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button title="Print" icon="print-outline" variant="secondary" loading={busy === "print"} onPress={() => run("print")} testID={`${testID}-print`} />
            </View>
            {image && (
              <View style={{ flex: 1 }}>
                <Button title="Download" icon="download-outline" variant="secondary" loading={busy === "save"} onPress={() => run("save")} testID={`${testID}-download`} />
              </View>
            )}
          </View>
        )}
      </View>

      <Modal visible={full && !!current} animationType="fade" onRequestClose={() => setFull(false)} transparent>
        <View style={[styles.modal, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.md }]} testID={`${testID}-fullscreen`}>
          <View style={styles.modalBar}>
            <Text style={styles.modalTitle}>{isQr ? "Postage QR code" : "Postage label"} · #{orderNumber}</Text>
            <Pressable onPress={() => setFull(false)} hitSlop={12} style={styles.close} accessibilityLabel="Close" testID={`${testID}-close`}>
              <Ionicons name="close" size={26} color={colors.onSurface} />
            </Pressable>
          </View>
          <View style={[styles.modalBody, isQr && styles.modalBodyQr]}>
            {current && <Image source={{ uri: dataUri(current) }} contentFit="contain" style={styles.previewImg} />}
          </View>
          {isQr && <Text style={styles.modalHint}>Turn screen brightness up when scanning.</Text>}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fileRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  fileIcon: { width: 44, height: 44, borderRadius: radius.sm, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  fileTitle: { color: colors.onSurface, fontSize: fontSize.base, fontWeight: fontWeight.medium },
  fileMeta: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, marginTop: 2 },
  preview: { height: 220, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  previewQr: { backgroundColor: colors.surfaceInverse, padding: spacing.md },
  previewImg: { width: "100%", height: "100%" },
  expand: { position: "absolute", right: spacing.sm, top: spacing.sm, backgroundColor: colors.overlay, borderRadius: radius.sm, padding: 6 },
  actions: { gap: spacing.sm },
  row: { flexDirection: "row", gap: spacing.sm },
  error: { color: colors.error, fontSize: fontSize.sm },
  modal: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg, gap: spacing.md },
  modalBar: { flexDirection: "row", alignItems: "center" },
  modalTitle: { flex: 1, color: colors.onSurface, fontSize: fontSize.lg, fontWeight: fontWeight.medium },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  modalBody: { flex: 1, borderRadius: radius.md, overflow: "hidden", backgroundColor: colors.surfaceTertiary },
  modalBodyQr: { backgroundColor: colors.surfaceInverse, padding: spacing.xl },
  modalHint: { color: colors.onSurfaceTertiary, fontSize: fontSize.sm, textAlign: "center" },
});
