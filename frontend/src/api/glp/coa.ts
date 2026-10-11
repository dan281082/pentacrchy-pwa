// Certificate of Analysis (COA): fetched only through the authenticated,
// members-only connector route — never from a public URL on our site.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as WebBrowser from "expo-web-browser";
import { Linking, Platform } from "react-native";

import type { ProductCoa } from "@/src/types/catalogue";

import { glpFetch } from "./client";

export interface CoaFile { mime: string; name: string; data: string }

export function mapCoa(c: any): ProductCoa | null {
  if (!c || typeof c !== "object") return null;
  if (c.type === "url" && typeof c.url === "string" && c.url) return { type: "url", url: c.url };
  if (c.type === "file") return { type: "file", mime: String(c.mime ?? ""), name: String(c.name ?? "Certificate of Analysis") };
  return null;
}

export async function fetchCoaFile(productId: number): Promise<CoaFile> {
  const r = await glpFetch<any>(`/products/${productId}/coa`, { retries: 1 });
  const c = r?.coa ?? {};
  if (!c.data) throw new Error("Certificate unavailable.");
  return { mime: String(c.mime ?? "application/pdf"), name: String(c.name ?? "certificate-of-analysis.pdf"), data: String(c.data) };
}

export async function openCoaUrl(url: string) {
  if (Platform.OS === "web") { window.open(url, "_blank", "noopener,noreferrer"); return; }
  await WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
}

function blobUrl(f: CoaFile): string {
  const bin = atob(f.data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: f.mime }));
}

/** Open a PDF COA (new tab on web, share/preview sheet on device). */
export async function openCoaPdf(f: CoaFile, tab?: Window | null) {
  if (Platform.OS === "web") {
    const url = blobUrl(f);
    if (tab) tab.location.href = url; else window.open(url, "_blank");
    return;
  }
  const uri = `${FileSystem.cacheDirectory}pentarchy-coa-${Date.now()}.pdf`;
  await FileSystem.writeAsStringAsync(uri, f.data, { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: f.mime, dialogTitle: "Certificate of Analysis" });
}
