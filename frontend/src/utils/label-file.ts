// Postage label file helpers: pick (PDF/JPG/PNG), read as base64, and open /
// print / save a label returned by the authenticated API. Files are never
// written to public storage — only the app's private cache on device.

import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

import type { LabelFile, LabelKind } from "@/src/types/order";

export const LABEL_MAX_BYTES = 5 * 1024 * 1024;

export interface PickedLabel {
  name: string;
  mime: string;
  size: number;
  data: string; // base64 (no data: prefix)
}

export class LabelPickError extends Error {}

const ALLOWED: Record<LabelKind, string[]> = {
  label: ["application/pdf", "image/jpeg", "image/png"],
  qr: ["image/jpeg", "image/png"],
};

function guessMime(name: string, given?: string | null): string {
  if (given) return given === "image/jpg" ? "image/jpeg" : given;
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "";
}

async function readBase64(asset: DocumentPicker.DocumentPickerAsset): Promise<string> {
  if (Platform.OS === "web") {
    const blob: Blob = (asset as any).file ?? (await (await fetch(asset.uri)).blob());
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(r.error);
      r.readAsDataURL(blob);
    });
    return dataUrl.slice(dataUrl.indexOf(",") + 1);
  }
  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
}

/** Opens the system file picker. Returns null if the user cancels. */
export async function pickLabelFile(kind: LabelKind): Promise<PickedLabel | null> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ALLOWED[kind],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (res.canceled || !res.assets?.length) return null;
  const asset = res.assets[0];
  const mime = guessMime(asset.name ?? "", asset.mimeType);
  if (!ALLOWED[kind].includes(mime)) {
    throw new LabelPickError(kind === "qr" ? "QR codes must be a JPG or PNG image." : "Labels must be a PDF, JPG or PNG file.");
  }
  if (asset.size && asset.size > LABEL_MAX_BYTES) throw new LabelPickError("Files must be 5 MB or smaller.");
  const data = await readBase64(asset);
  const size = asset.size ?? Math.floor((data.length * 3) / 4);
  if (size > LABEL_MAX_BYTES) throw new LabelPickError("Files must be 5 MB or smaller.");
  return { name: asset.name ?? `postage-${kind}`, mime, size, data };
}

export const isImage = (mime: string) => mime === "image/jpeg" || mime === "image/png";
export const dataUri = (f: { mime: string; data: string }) => `data:${f.mime};base64,${f.data}`;

function webBlobUrl(f: LabelFile): string {
  const bin = atob(f.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: f.mime }));
}

async function cacheFile(f: LabelFile, orderNumber: string): Promise<string> {
  const ext = f.mime === "application/pdf" ? "pdf" : f.mime === "image/png" ? "png" : "jpg";
  const uri = `${FileSystem.cacheDirectory}pentarchy-label-${orderNumber}.${ext}`;
  await FileSystem.writeAsStringAsync(uri, f.data, { encoding: FileSystem.EncodingType.Base64 });
  return uri;
}

/** Print the label (PDF printed directly; images printed full-page). */
export async function printLabel(f: LabelFile, orderNumber: string): Promise<void> {
  if (Platform.OS === "web") {
    const w = window.open(webBlobUrl(f), "_blank");
    if (w && isImage(f.mime)) w.addEventListener("load", () => w.print());
    return;
  }
  if (f.mime === "application/pdf") {
    await Print.printAsync({ uri: await cacheFile(f, orderNumber) });
  } else {
    await Print.printAsync({
      html: `<html><body style="margin:0;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${dataUri(f)}" style="max-width:100%;max-height:100%"/></body></html>`,
    });
  }
}

/** Open / save the label file (share sheet on device, new tab or download on web). */
export async function openOrSaveLabel(f: LabelFile, orderNumber: string): Promise<void> {
  if (Platform.OS === "web") {
    const a = document.createElement("a");
    a.href = webBlobUrl(f);
    a.download = f.filename || `pentarchy-label-${orderNumber}`;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const uri = await cacheFile(f, orderNumber);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: f.mime, dialogTitle: `Postage label · order ${orderNumber}` });
  }
}

export function formatBytes(n: number): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
